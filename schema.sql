create type public.app_role as enum ('super_admin','tenant_admin','tenant_user');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'tenant_user',
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.apps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  repository_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.apps enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles own read" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "super admin tenant all" on public.tenants
for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

create policy "tenant members read tenant" on public.tenants
for select to authenticated using (
  id = (select tenant_id from public.profiles where id = auth.uid())
);

create policy "tenant members read apps" on public.apps
for select to authenticated using (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

create policy "super admin apps all" on public.apps
for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- After creating the first user:
-- update public.profiles set role='super_admin' where id='AUTH_USER_UUID';


-- Public self-signup intentionally creates a tenant_user profile.
-- Tenant assignment and promotion should be performed by authorized
-- backend/admin workflows; do not expose role promotion to the browser.
