-- Sarv migration 001
-- Fix profile authorization policy recursion.
-- The frontend only needs to read the currently authenticated user's profile.
-- Super Admin privilege is checked by the application AND should be enforced
-- by RLS on privileged tables/functions.

drop policy if exists "super admin profile read" on public.profiles;
drop policy if exists "profiles own read" on public.profiles;

create policy "profiles own read"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Verification query (run while inspecting the schema; the SQL editor itself
-- does not represent a browser user's auth.uid()):
-- select id, full_name, role, tenant_id from public.profiles;
