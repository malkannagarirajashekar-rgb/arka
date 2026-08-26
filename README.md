# Trinetra Platform — Baby Step 01 (production UI foundation)

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS 4 dependency-ready design system (current visual tokens are custom CSS)
- shadcn/Radix-compatible architecture
- Motion for React animations
- Lucide React icons
- Apache ECharts dependency-ready for the SOC/dashboard phase
- TanStack Query
- React Hook Form + Zod
- Supabase Auth + PostgreSQL + RLS
- Docker + Docker Compose
- Nginx production container

## Run locally

1. Copy `.env.example` to `.env`.
2. Add your Supabase URL and public anon key.
3. Run:

```bash
docker compose up --build
```

Open http://localhost:5173.

## Production container

```bash
docker compose --profile production up --build
```

Open http://localhost:8080.

## Supabase

Run `schema.sql` in Supabase SQL Editor. Create your first user in Supabase Authentication. Promote it to `super_admin` using the SQL at the bottom of the schema.

Never expose the Supabase service-role key in VITE variables or browser code.

## Current pages

- `/` — public company website
- `/login` — Supabase sign in
- `/login?mode=signup` — Supabase sign up + email verification
- `/login?mode=forgot` — password recovery
- `/admin` — Super Admin foundation

## Next build phase

The next implementation should turn the static dashboard data into real Supabase data and build:

1. Tenant CRUD
2. Tenant Admin creation
3. Tenant isolation
4. User management
5. Apps CRUD
6. Audit logging
7. Integration service
8. Agent service
9. Git worker service

Privileged Git/Agent/Integration work must run in backend/worker containers rather than in the browser.


## Authentication flow

- Sign in with email/password
- Public account creation
- Supabase email verification
- Forgot-password email
- Password visibility toggle
- Password strength validation
- New public accounts are created as `tenant_user`
- Tenant assignment and role promotion remain an admin-controlled operation

### Supabase email verification

In Supabase Dashboard → Authentication → URL Configuration, add your local and production application URLs to the allowed redirect URLs, for example:

- `http://localhost:5173/login?verified=1`
- your production application URL

For development, the signup flow will show a confirmation message after Supabase creates the account.


## Mobile / PWA / iOS / Android

The UI is optimized as a first-class mobile experience rather than a desktop page that merely scales down.

Included:
- iPhone/iPad safe-area support
- Dynamic viewport metadata
- Touch-sized controls
- Mobile navigation drawer
- Responsive admin dashboard
- Portrait and landscape handling
- `prefers-reduced-motion` support
- PWA manifest and service worker
- Android installable PWA path
- iOS Add to Home Screen support
- Capacitor configuration for a future Play Store/App Store build

### PWA

Build production:

```bash
npm run build
```

Serve the `dist` folder over HTTPS in production. Browsers can then offer installation depending on platform/browser support.

### Capacitor

The project is also prepared to package the same React application as native Android/iOS apps:

```bash
npm install
npm run cap:sync
npx cap add android
npx cap add ios
```

The native platform directories are intentionally not committed/generated in this baby step. They should be created on the relevant development machines.

The same UI code remains the source of truth.


## Role-protected routing

`/admin` is no longer a session-only route.

The app:
1. Gets the authenticated Supabase user.
2. Reads the matching `public.profiles` row.
3. Verifies the Trinetra role.
4. Allows only `super_admin` into `/admin`.
5. Routes `tenant_admin` to `/tenant`.
6. Routes `tenant_user` to `/app`.
7. Signs out and returns to login if the profile cannot be verified.

This is a frontend guard for user experience. The real security boundary remains PostgreSQL RLS. Privileged operations must also be protected server-side/RLS; a browser route guard is never considered sufficient security by itself.


## Fix existing Supabase project

If this project was created before migration `001_fix_profile_rls.sql`, run this in Supabase SQL Editor:

```sql
drop policy if exists "super admin profile read" on public.profiles;
drop policy if exists "profiles own read" on public.profiles;

create policy "profiles own read"
on public.profiles
for select
to authenticated
using (id = auth.uid());
```

Then restart the app:

```bash
docker compose down
docker compose up --build
```

The `/admin` page now shows the actual profile/RLS error instead of silently redirecting when authentication succeeds but authorization lookup fails.


## Official Trinetra logo

The supplied geometric mark is now the primary brand asset at `public/brand/trinetra-logo.png`.

It is used by the public site, authentication screens, Super Admin sidebar, mobile navigation, favicon, and PWA manifest. The source artwork is preserved; dark mode applies a CSS inversion so the mark remains legible on the charcoal interface.
