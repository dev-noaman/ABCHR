# read/project-context.md

## Project Context — Arafat Visitor Management System

- **Project name:** Arafat VMS
- **Stack:** NestJS 10 + Prisma 4.16 + PostgreSQL 16 (backend), React 18/Vite (admin), React 19/Vite (kiosk), React Native/Expo 54 (mobile)
- **Package manager:** npm
- **Test framework:** Jest (backend)
- **Auth approach:** JWT Bearer tokens, role-based guards (ADMIN/RECEPTION/HOST/STAFF)
- **API response format:** Nested objects (e.g. `visitor: { name, company }` not flat `visitorName`)
- **Domain:** arafatvisitor.cloud (+ www)

## Key Conventions

- Backend modules: controller (thin) → service (logic) → DTOs (validation)
- Mobile API: Axios with interceptor, React Query v5 hooks, Zustand stores
- Kiosk: same-origin API calls, session restore with timeout
- All visit endpoints return nested `visitor` object
- Lookups return plain `LookupItem[]` arrays with `label` field

## What to Never Do

- Never return flat visitor fields from API (always nested)
- Never send `expectedArrivalDate` (use `expectedDate`)
- Never use `NodeJS.Timeout` in browser context (use `ReturnType<typeof setTimeout>`)
- Never forget `npx prisma generate` after schema changes
- Never skip `@SkipThrottle()` for all three strategies on non-login endpoints
- Never assume single QR format (both `VMS-NNNNNN` and UUID must work)
- Never allow only one CORS origin (both www and non-www required)
