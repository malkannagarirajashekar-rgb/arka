# Arka Platform — UI rebuild

A Vite + React + TypeScript Arka security platform with a redesigned public site and authentication screen.

## Included

- `/` — redesigned Arka public website
- `/login` — reference-inspired secure login / signup / password recovery UI
- `/admin` — existing protected super-admin area
- `/tenant` — protected tenant placeholder
- `/app` — protected tenant-user placeholder
- Supabase authentication and profile/role checks
- Supplied Arka logo asset
- Persistent dark/light theme switch

## Setup

```bash
npm install
npm run dev
```

Create `.env` from `.env.example` and provide your existing Supabase project values:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Keep the `.env` from your working project if it already contains the correct values.

## Build

```bash
npm run build
```

## Authentication

Email/password authentication remains handled by Supabase. New public signups are created as `tenant_user` profiles by the database trigger. The browser does not expose role promotion.
