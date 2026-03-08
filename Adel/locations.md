# Locations (AreaBasedAttendance)

Reference for geofenced check-in/check-out locations in AbcHRM.

## Overview

Locations are stored in `location_binds` and used by the **AreaBasedAttendance** module. When enabled, users must be within the configured radius (meters) of an allowed location to check in or out. The system uses the Haversine formula to validate GPS coordinates.

---

## Table: location_binds

| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| user_id | bigint (nullable) | Specific user; null = eligible for all users |
| latitude | decimal(10,7) | Latitude coordinate |
| longitude | decimal(10,7) | Longitude coordinate |
| address | string | Display address |
| distance | string | Geofence radius in meters |
| status | enum | active, inactive |
| company_id | bigint | Multi-tenant |
| branch_id | bigint | Multi-tenant |
| timestamps | | created_at, updated_at |

---

## Default Location Binds (Qatar)

Seeded by migration/`LocationBindSeeder` at 100m radius:

| Address | Latitude | Longitude | Radius |
|---------|----------|-----------|--------|
| Marina 50 (Lusail, Qatar) | 25.3845691 | 51.5250807 | 100m |
| Barwa Towers (Doha/Al Wakrah area, Qatar) | 25.2860493 | 51.5050002 | 100m |
| Element City Center (Doha, Qatar) | 25.3275564 | 51.5310655 | 100m |

`user_id` is null — all users can use these locations.

---

## Scope Types

| user_id | Scope |
|---------|-------|
| null | **Eligible for all users** — any employee can check in from this location |
| user_id set | **Specific user** — only the bound user can check in from this location |

---

## Map System

| Component | Purpose |
|-----------|---------|
| **Leaflet.js** 1.9.4 | Map rendering |
| **OpenStreetMap** | Map tiles (no API key) |
| **Nominatim** | Reverse geocoding (address from coordinates) |

**Key file:** `public/assets/js/leaflet-hrm-map.js` — `HRMLeafletMap` class for location picker.

---

## Module Setup

1. Enable AreaBasedAttendance module.
2. Publish assets: `php artisan module:publish AreaBasedAttendance`
3. Admin UI: `/hrm-setup/locations` (when module enabled)

---

## Notes

- Users with `is_free_location` bypass the geofence check.
- When AreaBasedAttendance is active, the branch check for check-in is skipped.
- Handsfree API exposes `locationBinds` to mobile/biometric devices.
