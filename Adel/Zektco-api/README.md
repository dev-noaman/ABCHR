# ZKTeco Attendance Collector

A Docker-based service that collects attendance logs from ZKTeco fingerprint devices and syncs them with your Laravel HR system API.

**Dashboard:** https://attendance.noaman.cloud

---

## Quick Start (Docker)

```bash
docker compose up -d
```

---

## Configuration

Edit `main.py` and update these values:

```python
DEVICES = [
    {"ip": "192.168.1.201", "port": 4370, "name": "Branch 1"},
    {"ip": "192.168.1.202", "port": 4370, "name": "Branch 2"},
    {"ip": "192.168.1.203", "port": 4370, "name": "Branch 3"},
]

HR_API_URL = "https://yourdomain.com/api/attendance/import"
API_TOKEN  = "YOUR_API_TOKEN"
```

---

## Docker Commands
```bash
# Start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild
docker compose down && docker compose build --no-cache && docker compose up -d

# Clear all logs and re-fetch from devices
docker compose exec zkteco-api python3 main.py clear-and-fetch
```

---

## Dashboard

- **Permanent URL:** https://attendance.noaman.cloud
- **Local:** http://localhost:8001 (port 8001 if 8000 is in use)

The dashboard shows attendance logs with filters for date range and staff. It auto-refreshes every 5 seconds. **Logic:** Staff select Check In or Check Out on any device; `punch_state` records that choice. Check-in column = first of all check-in punches; check-out column = last of all check-out punches. Per-device mapping in `DEVICE_PUNCH_MAP` (e.g. Element uses 1=In, 0=Out). Staff can punch in on one device and out on another. Staff with multiple device IDs are merged by name (no duplicates).

---

## Evolution API (WhatsApp)

Evolution API runs in a separate stack for use across multiple projects.

| URL | Purpose |
|-----|---------|
| **https://evolution.noaman.cloud** | Evolution Manager UI (default) |
| **https://evolution.noaman.cloud/manager** | Manager (instances, login) |
| **Local API** | http://127.0.0.1:8080 |
| **Local Manager** | http://127.0.0.1:3000 |

**Location:** `../evolution-api/`

```bash
cd ../evolution-api
docker compose up -d
```

**Login:** Server URL = `https://evolution.noaman.cloud`, API Key from `.env` (`AUTHENTICATION_API_KEY`).

---

## Verify It Works
```
# Check container
docker ps

# Check volume
docker volume ls

# View logs
docker logs zkteco-api
```

---

## Troubleshooting
| Problem | Solution |
|--------|----------|
| Device connection failed | Check IP, port 4370, connectivity |
| API connection error | Verify HR_API_URL and API_TOKEN |
| Container won't start | Run `docker compose logs` for errors |
