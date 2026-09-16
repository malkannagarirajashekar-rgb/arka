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


## Integrated organization onboarding

The existing Arka React/Vite app now includes:
- Role-aware auth routing for Super Admin / Tenant Admin / Tenant User.
- Tenant Admin organization onboarding at `/onboarding`.
- Five-step onboarding with step-by-step Supabase persistence.
- Tenant creation + Tenant Admin assignment through the `save_tenant_onboarding` SECURITY DEFINER function.
- Organization context stored in `tenants.onboarding_data` and `tenant_onboarding`.
- Tenant Admin welcome/workspace at `/tenant`.
- Optional Neo4j synchronization through `supabase/functions/sync-organization-graph`.

Apply the SQL in `schema.sql` to a fresh database, or run `migrations/002_tenant_onboarding.sql` on an existing Arka database.

For Neo4j, deploy the Edge Function and configure `NEO4J_HTTP_URL`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` as Supabase Edge Function secrets. Neo4j credentials are intentionally not exposed to the browser.

The exact remaining onboarding questions should be aligned with the brother's source/template once that source file is available; the integrated UI keeps those fields structurally isolated for that replacement.

## Login / routing fix
Run `migrations/004_auth_access_context.sql` in Supabase after the existing schema migrations. This adds the secure `get_my_access_context()` RPC used to route authenticated users to Admin, Tenant Admin, Tenant User, or onboarding.
