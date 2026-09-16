# ARKA database migrations

Use **one** migration for a fresh or repaired ARKA Supabase project:

`supabase/migrations/20260916_0001_arka_final.sql`

The older numbered files in this directory are historical and should not be run
in addition to the final migration. The final migration is idempotent for the
ARKA tables/functions it owns and creates `public.user_tenant_memberships`
before any helper function references it.
