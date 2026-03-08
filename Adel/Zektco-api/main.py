# main.py
# ZKTeco Attendance Collector for HR System
# - Pulls punch logs from ZKTeco devices on local network
# - Stores locally in SQLite (deduplication + offline buffer)
# - Syncs new records to Laravel HR API
# - Default timezone: Asia/Qatar (UTC+3)

import sqlite3
import requests
import schedule
import time
import uuid
import logging
import os
import threading
from datetime import datetime, timezone, timedelta
from flask import Flask, jsonify, request, Response
from zk import ZK

# =========================
# CONFIGURATION
# =========================

# Qatar timezone (UTC+3) — ZKTeco devices return local time with no tz info
QATAR_TZ = timezone(timedelta(hours=3))

DEVICES = [
    {"ip": "10.5.0.5", "port": 4370, "name": "Barwa 1"},
    {"ip": "10.2.0.9", "port": 4370, "name": "Barwa 2"},
    {"ip": "10.15.0.7", "port": 4370, "name": "Element"},
]

HR_API_URL = os.getenv("HR_API_URL", "https://yourdomain.com/api/attendance/import")
API_TOKEN = os.getenv("API_TOKEN", "YOUR_API_TOKEN")

# Database path: use /data/attendance.db in Docker (set via env), ./attendance.db for local runs
DB_FILE = os.getenv("DB_FILE", "./attendance.db")

POLL_INTERVAL_SECONDS = 60
SYNC_BATCH_SIZE = 500

# Retry settings for API sync
MAX_SYNC_RETRIES = 3
RETRY_BACKOFF_SECONDS = 5

# Punch mapping: all devices use 0=Check In, 1=Check Out
PUNCH_CHECK_IN, PUNCH_CHECK_OUT = 0, 1


# =========================
# LOGGING
# =========================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)


# =========================
# DATABASE INIT
# =========================

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS attendance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_ip TEXT,
        device_name TEXT,
        user_id TEXT,
        timestamp_local TEXT,
        timestamp_utc TEXT,
        punch_state INTEGER,
        verify_mode INTEGER,
        synced INTEGER DEFAULT 0,
        sync_attempts INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_ip, user_id, timestamp_local)
    )
    """)

    cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_synced
    ON attendance_logs(synced)
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS zkteco_users (
        user_id TEXT PRIMARY KEY,
        name TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()


# =========================
# DEVICE READ
# =========================

def read_device_logs(device):
    ip = device["ip"]
    port = device["port"]
    name = device.get("name", ip)

    logger.info(f"Connecting to device {name} ({ip})")

    zk = ZK(ip, port=port, timeout=5)
    conn = None

    try:
        conn = zk.connect()
        conn.disable_device()
        logs = conn.get_attendance()
        conn.enable_device()
        conn.disconnect()
        logger.info(f"Device {name}: read {len(logs)} total records")
        return logs

    except Exception as e:
        logger.error(f"Device {name} ({ip}) connection failed: {e}")
        if conn:
            try:
                conn.enable_device()
                conn.disconnect()
            except Exception:
                pass
        return []


def fetch_users_from_devices():
    """Fetch user names from ZKTeco devices and store in zkteco_users."""
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    for device in DEVICES:
        ip = device["ip"]
        port = device["port"]
        name = device.get("name", ip)
        zk = ZK(ip, port=port, timeout=5)
        dev_conn = None
        try:
            dev_conn = zk.connect()
            users = dev_conn.get_users()
            for user in users:
                uid = str(getattr(user, "user_id", getattr(user, "uid", "")))
                uname = getattr(user, "name", "") or ""
                if uid:
                    cur.execute(
                        "INSERT OR REPLACE INTO zkteco_users (user_id, name, updated_at) VALUES (?, ?, datetime('now'))",
                        (uid, uname.strip() or None),
                    )
            logger.info(f"Device {name}: fetched {len(users)} users")
        except Exception as e:
            logger.error(f"Device {name} ({ip}) user fetch failed: {e}")
        finally:
            if dev_conn:
                try:
                    dev_conn.disconnect()
                except Exception:
                    pass

    conn.commit()
    conn.close()


# =========================
# TIMEZONE CONVERSION
# =========================

def localize_timestamp(naive_dt):
    """
    ZKTeco devices return naive datetime in local time.
    Treat as Qatar time (UTC+3) and also store UTC equivalent.
    """
    local_dt = naive_dt.replace(tzinfo=QATAR_TZ)
    utc_dt = local_dt.astimezone(timezone.utc)
    return local_dt.isoformat(), utc_dt.isoformat()


# =========================
# INSERT LOGS
# =========================

def insert_logs(device, logs):

    device_ip = device["ip"]
    device_name = device.get("name", device_ip)

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    inserted = 0

    for log in logs:
        try:
            ts_local, ts_utc = localize_timestamp(log.timestamp)
            punch_state = getattr(log, "punch", getattr(log, "status", 0))
            verify_mode = getattr(log, "verify_mode", 0)  # Default to 0 if attribute doesn't exist

            cur.execute("""
            INSERT OR IGNORE INTO attendance_logs
            (device_ip, device_name, user_id, timestamp_local, timestamp_utc, punch_state, verify_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                device_ip,
                device_name,
                str(log.user_id),
                ts_local,
                ts_utc,
                punch_state,
                verify_mode,
            ))

            if cur.rowcount > 0:
                inserted += 1

        except Exception as e:
            logger.error(f"Insert error for device {device_name}: {e}")

    conn.commit()
    conn.close()

    return inserted


# =========================
# COLLECTOR JOB
# =========================

def collect_devices():

    total_new = 0

    for device in DEVICES:
        logs = read_device_logs(device)

        if not logs:
            continue

        new_rows = insert_logs(device, logs)

        if new_rows > 0:
            logger.info(f"{device.get('name', device['ip'])}: {new_rows} new logs inserted")

        total_new += new_rows

    if total_new > 0:
        logger.info(f"Total new logs collected: {total_new}")
    else:
        logger.info("No new logs this cycle")


# =========================
# SYNC TO HR
# =========================

def sync_to_hr():

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute("""
    SELECT id, device_ip, device_name, user_id, timestamp_local, timestamp_utc, punch_state
    FROM attendance_logs
    WHERE synced = 0 AND sync_attempts < ?
    ORDER BY timestamp_utc ASC
    LIMIT ?
    """, (MAX_SYNC_RETRIES, SYNC_BATCH_SIZE))

    rows = cur.fetchall()

    if not rows:
        conn.close()
        logger.info("No unsynced records")
        return

    records = []
    for r in rows:
        records.append({
            "event_uid": f"{r[1]}-{r[3]}-{r[4]}",
            "device_ip": r[1],
            "device_name": r[2],
            "employee_device_id": r[3],
            "timestamp_local": r[4],
            "timestamp_utc": r[5],
            "punch_state": r[6],
            "timezone": "Asia/Qatar",
        })

    payload = {
        "source": "zkteco_collector",
        "batch_id": str(uuid.uuid4()),
        "sent_at_utc": datetime.now(timezone.utc).isoformat(),
        "timezone": "Asia/Qatar",
        "record_count": len(records),
        "records": records,
    }

    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    row_ids = [r[0] for r in rows]

    for attempt in range(1, MAX_SYNC_RETRIES + 1):
        try:
            response = requests.post(
                HR_API_URL,
                json=payload,
                headers=headers,
                timeout=15,
            )

            if response.status_code == 200:
                placeholders = ",".join("?" * len(row_ids))
                cur.execute(
                    f"UPDATE attendance_logs SET synced = 1 WHERE id IN ({placeholders})",
                    row_ids,
                )
                conn.commit()
                logger.info(f"Synced {len(row_ids)} records (attempt {attempt})")
                break

            elif response.status_code == 207:
                try:
                    result = response.json()
                    accepted = result.get("accepted_uids", [])
                    if accepted:
                        accepted_ids = [
                            r[0] for r in rows
                            if f"{r[1]}-{r[3]}-{r[4]}" in accepted
                        ]
                        if accepted_ids:
                            ph = ",".join("?" * len(accepted_ids))
                            cur.execute(
                                f"UPDATE attendance_logs SET synced = 1 WHERE id IN ({ph})",
                                accepted_ids,
                            )
                        rejected_ids = [rid for rid in row_ids if rid not in accepted_ids]
                        if rejected_ids:
                            ph = ",".join("?" * len(rejected_ids))
                            cur.execute(
                                f"UPDATE attendance_logs SET sync_attempts = sync_attempts + 1 WHERE id IN ({ph})",
                                rejected_ids,
                            )
                        conn.commit()
                        logger.info(f"Partial sync: {len(accepted_ids)} accepted, {len(rejected_ids)} rejected")
                except Exception as e:
                    logger.error(f"Failed to parse 207 response: {e}")
                break

            else:
                logger.error(f"API returned {response.status_code} (attempt {attempt}/{MAX_SYNC_RETRIES})")

        except requests.exceptions.Timeout:
            logger.error(f"API timeout (attempt {attempt}/{MAX_SYNC_RETRIES})")
        except requests.exceptions.ConnectionError:
            logger.error(f"API connection error (attempt {attempt}/{MAX_SYNC_RETRIES})")
        except Exception as e:
            logger.error(f"Sync error (attempt {attempt}/{MAX_SYNC_RETRIES}): {e}")

        if attempt < MAX_SYNC_RETRIES:
            wait = RETRY_BACKOFF_SECONDS * attempt
            logger.info(f"Retrying in {wait}s...")
            time.sleep(wait)

    else:
        placeholders = ",".join("?" * len(row_ids))
        cur.execute(
            f"UPDATE attendance_logs SET sync_attempts = sync_attempts + 1 WHERE id IN ({placeholders})",
            row_ids,
        )
        conn.commit()
        logger.error(f"All {MAX_SYNC_RETRIES} attempts failed for {len(row_ids)} records")

    conn.close()


# =========================
# HEALTH CHECK
# =========================

def log_status():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM attendance_logs")
    total = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM attendance_logs WHERE synced = 0")
    pending = cur.fetchone()[0]

    cur.execute(
        "SELECT COUNT(*) FROM attendance_logs WHERE synced = 0 AND sync_attempts >= ?",
        (MAX_SYNC_RETRIES,),
    )
    failed = cur.fetchone()[0]

    conn.close()

    logger.info(f"Status — Total: {total} | Pending sync: {pending} | Failed: {failed}")


# =========================
# WEB DASHBOARD
# =========================

def create_app():
    app = Flask(__name__)

    @app.route("/api/staff")
    def api_staff():
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT a.user_id, COALESCE(u.name, '') FROM attendance_logs a LEFT JOIN zkteco_users u ON a.user_id = u.user_id ORDER BY a.user_id")
        rows = [(str(r[0]), (r[1] or "").strip() or "—") for r in cur.fetchall()]
        conn.close()
        # Deduplicate by name: keep first (lowest) user_id per name
        seen = {}
        for uid, name in rows:
            if name not in seen:
                seen[name] = uid
        staff = [{"id": uid, "name": name} for name, uid in sorted(seen.items(), key=lambda x: (x[0], x[1]))]
        return jsonify({"staff": staff})

    def _parse_time(ts):
        """Extract HH:MM from timestamp like 2026-03-04T16:12:55+03:00"""
        if not ts:
            return "—"
        try:
            return ts[11:16] if len(ts) >= 16 else ts
        except Exception:
            return ts

    @app.route("/api/attendance")
    def api_attendance():
        user_id = request.args.get("user_id", "").strip()
        from_date = request.args.get("from_date", "").strip()
        to_date = request.args.get("to_date", "").strip()
        hide_empty = request.args.get("hide_empty", "1") == "1"

        # Default: 1st of current month to today (Qatar tz)
        now = datetime.now(QATAR_TZ)
        if not from_date:
            from_date = now.replace(day=1).strftime("%Y-%m-%d")
        if not to_date:
            to_date = now.strftime("%Y-%m-%d")

        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()

        # 1. Get names and build name->user_ids mapping (merge duplicates by name)
        cur.execute("SELECT user_id, name FROM zkteco_users")
        names = {str(r[0]): (r[1] or "—") for r in cur.fetchall()}
        cur.execute("SELECT DISTINCT user_id FROM attendance_logs")
        all_uids = [str(r[0]) for r in cur.fetchall()]
        name_to_ids = {}
        for uid in all_uids:
            name = names.get(uid) or "—"
            name_to_ids.setdefault(name, []).append(uid)
        for name in name_to_ids:
            name_to_ids[name].sort(key=lambda x: (x.isdigit() and int(x) or 999999, x))

        # 2. Per-user: use punch_state (what user selected). Check-in = first of in-punches, check-out = last of out-punches
        cur.execute("""
            SELECT user_id, substr(timestamp_local, 1, 10) AS work_date,
                   device_ip, punch_state, timestamp_local
            FROM attendance_logs
            WHERE substr(timestamp_local, 1, 10) BETWEEN ? AND ?
              AND punch_state IN (0, 1)
        """, (from_date, to_date))
        per_user = {}
        for r in cur.fetchall():
            uid, d, device_ip, punch_state, ts = str(r[0]), r[1], r[2], r[3], r[4]
            in_state, out_state = PUNCH_CHECK_IN, PUNCH_CHECK_OUT
            key = (uid, d)
            if punch_state == in_state:
                if key not in per_user:
                    per_user[key] = [ts, None]
                else:
                    prev_ci, prev_co = per_user[key]
                    per_user[key] = [min(prev_ci, ts) if prev_ci else ts, prev_co]
            elif punch_state == out_state:
                if key not in per_user:
                    per_user[key] = [None, ts]
                else:
                    prev_ci, prev_co = per_user[key]
                    per_user[key] = [prev_ci, max(prev_co, ts) if prev_co else ts]
        for key in per_user:
            ci, co = per_user[key]
            if ci and co and ci > co:
                per_user[key] = (co, ci)

        conn.close()

        # 3. Merge by name: one row per (name, date), first check-in and last check-out across all ids
        attendance_by_name = {}
        for (uid, d), (ci, co) in per_user.items():
            name = names.get(uid) or "—"
            key = (name, d)
            if key not in attendance_by_name:
                attendance_by_name[key] = [ci, co]
            else:
                prev_ci, prev_co = attendance_by_name[key]
                ci_candidates = [x for x in (prev_ci, ci) if x]
                co_candidates = [x for x in (prev_co, co) if x]
                attendance_by_name[key] = [
                    min(ci_candidates) if ci_candidates else None,
                    max(co_candidates) if co_candidates else None
                ]

        # 4. Staff list: unique names (or ids for selected name when filtering)
        if user_id:
            sel_name = names.get(str(user_id)) or "—"
            staff_names = [sel_name] if sel_name in name_to_ids else [names.get(str(user_id)) or str(user_id)]
        else:
            staff_names = sorted(name_to_ids.keys(), key=lambda n: (n, name_to_ids[n][0] if name_to_ids.get(n) else ""))

        # 5. Generate records: one per (name, date)
        from_dt = datetime.strptime(from_date, "%Y-%m-%d").date()
        to_dt = datetime.strptime(to_date, "%Y-%m-%d").date()
        delta = (to_dt - from_dt).days + 1
        dates = [(from_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(delta)]

        records = []
        for name in staff_names:
            primary_id = name_to_ids.get(name, [""])[0] if name in name_to_ids else ""
            for d in dates:
                ci, co = attendance_by_name.get((name, d), (None, None))
                records.append({
                    "user_id": primary_id,
                    "staff_name": name,
                    "date": d,
                    "check_in": _parse_time(ci),
                    "check_out": _parse_time(co),
                })

        # Sort ASC: date first, then name
        records.sort(key=lambda r: (r["date"], r["staff_name"]))

        if hide_empty:
            records = [r for r in records if r["check_in"] != "—" or r["check_out"] != "—"]

        return jsonify({
            "records": records,
            "from_date": from_date,
            "to_date": to_date,
            "total_count": len(records),
        })

    HTML_PAGE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attendance Logs</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; margin: 20px; background: #1a1a1a; color: #e0e0e0; }
        h1 { margin-bottom: 16px; }
        .filters { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
        .filters label { font-weight: 500; }
        .filters input, .filters select { padding: 8px 12px; border-radius: 6px; background: #2d2d2d; color: #e0e0e0; border: 1px solid #444; }
        .filters input[type=date] { min-width: 140px; }
        select { min-width: 160px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #333; }
        th { background: #252525; font-weight: 600; }
        tr:hover { background: #252525; }
        .refresh { color: #888; font-size: 13px; margin-bottom: 8px; }
        .time { font-variant-numeric: tabular-nums; }
    </style>
</head>
<body>
    <h1>Attendance Logs</h1>
    <div class="refresh">Auto-refreshing every 5 seconds. <span id="stats"></span></div>
    <div class="filters">
        <label for="from_date">From:</label>
        <input type="date" id="from_date">
        <label for="to_date">To:</label>
        <input type="date" id="to_date">
        <label for="staff">Staff:</label>
        <select id="staff">
            <option value="">All staff</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="hide_empty" checked> Only days with punches
        </label>
    </div>
    <table>
        <thead>
            <tr>
                <th>Staff ID</th>
                <th>Staff Name</th>
                <th>Date</th>
                <th>Check-in</th>
                <th>Check-out</th>
            </tr>
        </thead>
        <tbody id="tbody"></tbody>
    </table>
    <script>
        const staffSelect = document.getElementById('staff');
        const fromInput = document.getElementById('from_date');
        const toInput = document.getElementById('to_date');
        const hideEmptyCheck = document.getElementById('hide_empty');
        const tbody = document.getElementById('tbody');

        function toLocalDateStr(d) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + day;
        }
        function setDefaultDates() {
            const now = new Date();
            if (!fromInput.value) {
                fromInput.value = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
            }
            if (!toInput.value) {
                toInput.value = toLocalDateStr(now);
            }
        }

        function formatDate(d) {
            if (!d) return '—';
            const [y, m, day] = d.split('-');
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return day + ' ' + (months[parseInt(m)-1] || m) + ' ' + y;
        }

        async function loadStaff() {
            const r = await fetch('/api/staff');
            const d = await r.json();
            const current = staffSelect.value;
            staffSelect.innerHTML = '<option value="">All staff</option>' +
                d.staff.map(s => `<option value="${s.id}">${s.name ? s.name + ' (' + s.id + ')' : s.id}</option>`).join('');
            staffSelect.value = current || '';
        }

        async function loadAttendance() {
            setDefaultDates();
            const params = new URLSearchParams({
                from_date: fromInput.value,
                to_date: toInput.value,
                hide_empty: hideEmptyCheck.checked ? '1' : '0'
            });
            if (staffSelect.value) params.set('user_id', staffSelect.value);
            const r = await fetch('/api/attendance?' + params);
            const d = await r.json();
            document.getElementById('stats').textContent = d.records.length + ' attendance records in range.';
            tbody.innerHTML = d.records.map(row =>
                `<tr>
                    <td>${row.user_id}</td>
                    <td>${row.staff_name}</td>
                    <td>${formatDate(row.date)}</td>
                    <td class="time">${row.check_in}</td>
                    <td class="time">${row.check_out}</td>
                </tr>`
            ).join('') || '<tr><td colspan="5">No records</td></tr>';
        }

        staffSelect.addEventListener('change', loadAttendance);
        fromInput.addEventListener('change', loadAttendance);
        toInput.addEventListener('change', loadAttendance);
        hideEmptyCheck.addEventListener('change', loadAttendance);
        setDefaultDates();
        loadStaff().then(loadAttendance);
        setInterval(loadAttendance, 5000);
    </script>
</body>
</html>
"""

    @app.route("/")
    def index():
        return Response(HTML_PAGE, mimetype="text/html")

    return app


def run_flask():
    from waitress import serve
    app = create_app()
    serve(app, host="0.0.0.0", port=8000)


# =========================
# CLEAR AND RE-FETCH
# =========================

def clear_and_fetch():
    """Clear all attendance_logs and zkteco_users, then re-fetch from devices."""
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM attendance_logs")
    before = cur.fetchone()[0]
    cur.execute("DELETE FROM attendance_logs")
    cur.execute("DELETE FROM zkteco_users")
    conn.commit()
    conn.close()
    logger.info(f"Cleared {before} attendance logs and all user names")

    fetch_users_from_devices()
    collect_devices()

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM attendance_logs")
    after = cur.fetchone()[0]
    conn.close()
    logger.info(f"Re-fetched: {after} attendance records from devices")


# =========================
# MAIN LOOP
# =========================

def run():

    init_db()

    fetch_users_from_devices()

    logger.info(f"Collector starting — timezone: Asia/Qatar (UTC+3)")
    logger.info(f"Devices configured: {len(DEVICES)}")
    logger.info(f"Poll interval: {POLL_INTERVAL_SECONDS}s | Batch size: {SYNC_BATCH_SIZE}")

    schedule.every(10).minutes.do(fetch_users_from_devices)

    # Start Flask in background thread
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    logger.info("Dashboard available at http://0.0.0.0:8000")

    collect_devices()
    sync_to_hr()

    schedule.every(POLL_INTERVAL_SECONDS).seconds.do(collect_devices)
    schedule.every(POLL_INTERVAL_SECONDS).seconds.do(sync_to_hr)
    schedule.every(10).minutes.do(log_status)

    logger.info("Collector running")

    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "clear-and-fetch":
        clear_and_fetch()
    else:
        run()
