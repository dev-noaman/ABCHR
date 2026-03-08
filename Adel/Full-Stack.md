# Full Stack Reference

A generic reference for the **Laravel React Starter Kit + shadcn/ui** stack. Use this document when starting a new project with the same architecture.

---

## 1. Stack Overview

| Layer | Technology |
|-------|------------|
| **Backend** | Laravel 12 (PHP 8.2+) |
| **Frontend** | React 19 + TypeScript |
| **Bridge** | Inertia.js 2.x |
| **Build** | Vite 6 |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | shadcn/ui pattern (Radix UI + Tailwind) |

**Base:** Laravel React Starter Kit  
**Theme/Design System:** shadcn/ui (Radix UI primitives + Tailwind + CVA)

---

## 2. How It Works

Laravel and React connect via **Inertia.js**:

1. Laravel handles routing and controllers.
2. Controllers return `Inertia::render('PageName', $props)` instead of Blade views.
3. Inertia serves a single HTML shell and loads React pages.
4. Data flows from Laravel to React as props—no separate REST API for page views.
5. Client-side navigation uses Inertia’s router with full-page feel and preserved state.

---

## 3. Backend (PHP / Laravel)

### Core Versions

- **PHP:** ^8.2
- **Laravel:** ^12.0
- **Inertia Laravel:** ^2.0

### Essential Packages

```json
{
  "inertiajs/inertia-laravel": "^2.0",
  "laravel/framework": "^12.0",
  "tightenco/ziggy": "^2.4"
}
```

### Common Add-ons

| Package | Purpose |
|---------|---------|
| `spatie/laravel-permission` | Roles & permissions |
| `laravel/tinker` | REPL / debugging |
| `league/flysystem-aws-s3-v3` | AWS S3 storage |
| `spatie/laravel-medialibrary` | Media uploads |
| `barryvdh/laravel-dompdf` | PDF generation |
| `phpoffice/phpword` | Word documents |

### Dev Dependencies

```json
{
  "barryvdh/laravel-debugbar": "^3.16",
  "laravel/pail": "^1.2.2",
  "laravel/pint": "^1.18",
  "pestphp/pest": "^3.8",
  "pestphp/pest-plugin-laravel": "^3.1"
}
```

### Backend Structure

```
app/
├── Http/
│   ├── Controllers/
│   ├── Middleware/
│   └── Requests/
├── Models/
├── Services/
├── Helpers/
│   └── helper.php
├── Events/
└── Listeners/
```

---

## 4. Frontend (React / TypeScript)

### Core Versions

- **React:** ^19.0.0
- **TypeScript:** ^5.7
- **Vite:** ^6.0
- **Tailwind CSS:** ^4.0
- **Inertia React:** ^2.0

### Essential Dependencies

```json
{
  "@inertiajs/react": "^2.0.0",
  "@vitejs/plugin-react": "^4.3.4",
  "laravel-vite-plugin": "^1.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "vite": "^6.0",
  "tailwindcss": "^4.0.0",
  "@tailwindcss/vite": "^4.0.6",
  "@tailwindcss/oxide": "^4.1.10",
  "typescript": "^5.7.2"
}
```

### shadcn/ui Stack (Radix + utilities)

```json
{
  "@radix-ui/react-dialog": "^1.1.6",
  "@radix-ui/react-dropdown-menu": "^2.1.6",
  "@radix-ui/react-label": "^2.1.2",
  "@radix-ui/react-popover": "^1.1.3",
  "@radix-ui/react-select": "^2.1.6",
  "@radix-ui/react-slot": "^1.1.2",
  "@radix-ui/react-tabs": "^1.1.12",
  "@radix-ui/react-toast": "^1.2.6",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.0.1",
  "tailwindcss-animate": "^1.0.7"
}
```

### Common Add-ons

| Package | Purpose |
|---------|---------|
| `lucide-react` | Icons |
| `date-fns` | Dates |
| `@tiptap/react` + `@tiptap/starter-kit` | Rich text editor |
| `i18next` + `react-i18next` | i18n |
| `recharts` | Charts |
| `@fullcalendar/react` | Calendars |
| `@hello-pangea/dnd` | Drag & drop |
| `sonner` | Toast notifications |
| `next-themes` | Theme-aware components (e.g. Sonner) |

### Frontend Structure

```
resources/js/
├── app.tsx                 # Entry point, Inertia setup
├── pages/                  # Inertia page components (route targets)
├── components/             # Reusable React components
│   └── ui/                 # shadcn-style primitives (Radix UI)
├── layouts/                # Page layout wrappers
├── hooks/                  # Custom React hooks
├── contexts/               # React Context providers
├── lib/                    # Utilities (cn, etc.)
├── css/                    # Global styles
└── i18n/                   # i18n config (if used)
```

---

## 5. Build & Tooling

### Vite Config

- **Laravel Vite Plugin** for Blade/Inertia integration
- **@vitejs/plugin-react** for JSX/TSX
- **@tailwindcss/vite** for Tailwind v4

### Linting & Formatting

```json
{
  "eslint": "^9.17.0",
  "prettier": "^3.4.2",
  "prettier-plugin-tailwindcss": "^0.6.11",
  "typescript-eslint": "^8.23.0"
}
```

### Scripts

```json
{
  "dev": "vite",
  "build": "vite build",
  "build:ssr": "vite build && vite build --ssr",
  "lint": "eslint . --fix",
  "format": "prettier --write resources/",
  "types": "tsc --noEmit"
}
```

---

## 6. Theme System

### Appearance Modes

| Mode | Description |
|------|-------------|
| `light` | Light theme |
| `dark` | Dark theme |
| `system` | Follows OS `prefers-color-scheme` |

### Implementation

- Tailwind: `@custom-variant dark (&:is(.dark *))`
- Toggle: add/remove `dark` class on `<html>` or `<body>`
- CSS variables in `:root` (light) and `.dark` (dark)
- Optional `useAppearance`-style hook for user preference

### Accent Colors (optional)

Preset options: blue, green, purple, orange, red + custom hex. Applied via CSS variables (`--theme-color`, `--primary`, etc.).

---

## 7. Key Patterns

### Inertia Data Flow

```php
// Controller
return Inertia::render('Dashboard', [
    'users' => User::paginate(10),
]);
```

```tsx
// resources/js/pages/Dashboard.tsx
import { PageProps } from '@/types';

export default function Dashboard({ users }: PageProps<{ users: PaginatedData<User> }>) {
  return <div>...</div>;
}
```

### Class Merging (cn utility)

```tsx
import { cn } from '@/lib/utils';

<div className={cn('base-class', condition && 'conditional-class', className)} />
```

### Ziggy (routes in JS)

```tsx
import { route } from '@/lib/ziggy';

<Link href={route('dashboard')}>Dashboard</Link>
router.post(route('users.store'), data);
```

---

## 8. Commands

### Backend

```bash
php artisan serve          # Dev server
php artisan migrate        # Run migrations
php artisan db:seed       # Seed database
php artisan test          # Run Pest/PHPUnit
composer dev              # Full dev (serve + queue + pail + vite)
composer dev:ssr          # With SSR
```

### Frontend

```bash
npm run dev               # Vite dev server
npm run build             # Production build
npm run build:ssr         # SSR build
npm run lint              # ESLint
npm run format            # Prettier
npm run types             # TypeScript check
```

---

## 9. Project Bootstrap

### Starting a new project

1. **Create Laravel + React app:**
   ```bash
   composer create-project laravel/laravel my-app
   cd my-app
   composer require inertiajs/inertia-laravel tightenco/ziggy
   npm install @inertiajs/react react react-dom
   npm install -D @vitejs/plugin-react laravel-vite-plugin
   ```

2. **Add Tailwind v4:**
   ```bash
   npm install tailwindcss @tailwindcss/vite @tailwindcss/oxide
   ```

3. **Add Radix UI (shadcn components):**
   ```bash
   npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-slot
   npm install class-variance-authority clsx tailwind-merge tailwindcss-animate
   ```

4. **Or use the official Laravel React Starter Kit:**
   - [Laravel React Starter Kit](https://github.com/laravel/react-starter-kit)
   - Includes Laravel + Inertia + React + Vite + TypeScript
   - Add shadcn/ui components on top

---

## 10. File Reference

| File | Purpose |
|------|---------|
| `routes/web.php` | Web routes |
| `vite.config.ts` | Vite config |
| `resources/js/app.tsx` | Inertia + React entry |
| `resources/css/app.css` | Global CSS, Tailwind |
| `resources/views/app.blade.php` | Root Blade (Inertia mount point) |
| `config/app.php` | App config |
| `tsconfig.json` | TypeScript config |

---

## Summary

- **Backend:** Laravel 12 (PHP 8.2+)
- **Frontend:** React 19 + TypeScript
- **Bridge:** Inertia.js (no API needed for page data)
- **UI:** shadcn/ui pattern (Radix + Tailwind + CVA)
- **Build:** Vite 6
- ** styling:** Tailwind CSS 4
