⚠️ BEFORE writing any code, read the relevant files in `read/` directory. See reference table below or in `read/workflow.md`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HRM SaaS - A Laravel-based Human Resource Management application with multi-tenant support.

**Tech Stack:** Laravel 12 (PHP 8.2+) + Inertia.js + React 19 + Tailwind CSS 4 + Vite 6

## Commands

### Backend (Laravel)
```bash
composer dev              # Full dev server (serve + queue + pail + vite)
composer dev:ssr          # Dev server with SSR support
php artisan serve         # Start PHP dev server
php artisan test         # Run PHPUnit tests
php artisan migrate      # Run database migrations
php artisan db:seed      # Seed database
php artisan leave:allocate-balances   # Allocate/refill leave balances (yearly + monthly)
```

### Frontend
```bash
npm run dev               # Start Vite dev server
npm run build             # Production build
npm run build:ssr         # Build with SSR support
npm run lint              # ESLint with auto-fix
npm run format            # Prettier format
npm run types             # TypeScript type checking
```

## Architecture

### Application Directories
Composer autoloads `App\` from `app/` (primary). A parallel `main-file/app/` may exist; prefer editing `app/` for runtime code.

### Key Directories

| Path | Purpose |
|------|---------|
| `app/` | PHP backend (Controllers, Models, Services) — primary |
| `main-file/app/` | Parallel copy of app code (if present) |
| `resources/js/` | React frontend application |
| `resources/js/pages/` | Inertia.js page components (route targets) |
| `resources/js/components/ui/` | shadcn/ui-style UI primitives |
| `routes/web.php` | Main route definitions |
| `config/` | Laravel configuration |
| `database/migrations/` | Database schema migrations |

### Frontend Structure (`resources/js/`)
- `pages/` - Inertia.js page components mapped to routes
- `components/` - Reusable React components
- `components/ui/` - Radix UI + shadcn/ui pattern primitives
- `layouts/` - Page layout wrappers
- `hooks/` - Custom React hooks
- `contexts/` - React Context providers
- `lib/` - Utility functions including `cn()` for class merging

### Backend Structure (`app/`)
- `Http/Controllers/` - HTTP request handlers
- `Models/` - Eloquent ORM models
- `Services/` - Business logic layer
- `Helpers/helper.php` - Global helper functions

## Key Patterns

### Inertia.js Data Flow
No API layer needed - Inertia shares data directly from controllers to React components via props. Controllers return `Inertia::render('PageComponent', $props)`.

### User Roles
- `superadmin` - SaaS platform administrator
- `company` - Company/tenant administrator
- Employees use Spatie Permission package for granular permissions

### Permission Denied Redirect
When a user lacks the required permission for a route, `CheckPermission` redirects to `dashboard.redirect`. `DashboardController::redirectToFirstAvailablePage()` sends them to the first route they can access: users, roles, plans, referral, settings, or HR fallbacks (leave-types, employees, branches, departments). If none match, user is logged out.

### SaaS Multi-tenancy
- Check SaaS mode: `isSaas()` helper
- Get company ID: `getCompanyId($user)` helper
- Company slugs used for tenant identification
- Plan-based feature access control

### Settings
Use `settings($key, $default)` helper to retrieve user/company settings.

### Leave Management (GGM)
- **Leave types:** Annual, Casual, Sick, Unpaid, Tardy, Early Leave, Maternity (see `Adel/leave-type.md`).
- **Seeding:** `LeaveTypeSeeder` creates the 7 GGM types per company user. Run `php artisan db:seed --class=LeaveTypeSeeder` if types are missing.
- **Models:** `LeaveType`, `LeaveBalance`, `LeaveApplication`, `LeaveApplicationItem`.
- **Balance:** Sick/Unpaid have no balance; yearly types (Annual, Maternity) and monthly types (Casual, Tardy, Early Leave) use `leave_balances` with nullable `month`.
- **Refill:** `leave:allocate-balances` runs on 1st of each month (yearly + monthly allocations).
- **Mixed leave:** A single `LeaveApplication` can include multiple types via `leave_application_items`.
- **Annual leave tenure:** 21 days for < 5 years service, 30 days for ≥ 5 years (based on `employee.date_of_joining`).
- **Balance formula:** `remaining = allocated_days - prior_used_days - used_days`. No carry-forward, no manual adjustment.
  - `allocated_days` — set by policy or HR.
  - `prior_used_days` — one-time HR entry for days taken *before* the system; never touched by system logic.
  - `used_days` — incremented automatically when leave is approved; never edited by HR.
  - `carried_forward` and `manual_adjustment` columns exist in DB but are always 0 (unused).
- **Approval:** Users with `approve-leave-applications` / `reject-leave-applications` permissions (Manager, HR, Company Admin) can change application status.

### Employee Fields
- **`personal_number`** — required, stored in `employees` table, pre-filled with prefix `974`.
- **`phone`** — required, pre-filled with prefix `974`.
- **Nullable fields:** Banking info (bank_name, account_holder_name, account_number, bank_identifier_code, bank_branch), Emergency contact (emergency_contact_name, emergency_contact_relationship, emergency_contact_number), Address/Contact info (address_line_1/2, city, state, country, postal_code).
- **Employee code (`employee_code`)** — optional/nullable.
- **Bulk CSV import:** `GET hr/employees/template` downloads template; `POST hr/employees/bulk-import` creates employees from CSV.

### Shift Fields
- **`break_duration`** — nullable, defaults to `0` (supports Ramadan no-break shifts).

### Location Binding (Clock In/Out Geofencing)
- **Setting:** `locationRestrictionEnabled` — toggle in Settings → System Settings (company users only). When enabled, GPS is required to clock in/out and outside-location punches are flagged.
- **Behavior:** Clock in/out is **always accepted** regardless of location. If the employee punches from outside all allowed locations, the record is flagged and a dismissible warning toast is shown: *"You are clocked in/out from outside an allowed location. I will inform GM."*
- **Locations:** Stored in `location_binds` table (`name`, `latitude`, `longitude`, `radius_meters` default 100, `created_by`). Managed via Settings → Location Binding Settings. All locations are eligible for all company staff (no per-user scoping).
- **Validation:** `isWithinLocationRadius(userLat, userLng, locLat, locLng, radiusMeters)` helper in `helper.php` uses the Haversine formula. Location check logic is extracted into `AttendanceRecordController::checkLocationRestriction(array $validated, array $settings): bool|string` — returns `false` (off or inside), `true` (outside), `'missing_coords'`, or `'no_locations'`. Both `clockIn()` and `clockOut()` call this shared helper.
- **Audit columns:** `clock_in_latitude`, `clock_in_longitude`, `clock_out_latitude`, `clock_out_longitude` store exact coordinates. `clock_in_outside_location` and `clock_out_outside_location` (boolean, default false) flag punches from outside allowed locations.
- **Outside punches in reports:** Attendance Records list shows an amber "Outside" badge on any clock-in or clock-out that was flagged. A "Location Status" filter lets GM/admin filter to see only outside punches.
- **Flash key:** Backend sets `clockedOutsideLocation: true` in the session flash (shared via `HandleInertiaRequests`) when a punch is outside. Frontend reads `page.props.flash.clockedOutsideLocation`.
- **Frontend:** Employee dashboard calls `navigator.geolocation.getCurrentPosition()` before posting clock in/out when `locationRestrictionEnabled` is true (passed via `dashboardData`). `LeafletLocationPicker` (lazy-loaded) provides an OpenStreetMap map with a draggable marker and radius circle for the admin settings UI.
- **Permissions:** `manage-location-binding-settings`, `create-location-bind`, `edit-location-bind`, `delete-location-bind` — all assigned to company role. Run `PermissionSeeder` + `RoleSeeder` if missing.
- **Map stack:** Leaflet.js 1.9.4 + react-leaflet + OpenStreetMap tiles (no API key required). Component: `resources/js/components/LeafletLocationPicker.tsx`.
- **Key files:** `app/Models/LocationBind.php`, `app/Http/Controllers/LocationBindController.php`, `resources/js/pages/settings/components/location-binding-settings.tsx`, `resources/js/pages/hr/attendance-records/index.tsx`.

### Frontend Conventions
- Use `cn()` utility from `lib/utils.ts` for conditional class merging
- UI components follow shadcn/ui patterns with Radix UI primitives
- Theme support: light/dark/system via `HandleAppearance` middleware

