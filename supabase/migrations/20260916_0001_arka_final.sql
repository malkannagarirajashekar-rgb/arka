-- ============================================================
-- ARKA Identity + Multi-Tenant RBAC Foundation
-- FINAL COMPATIBILITY MIGRATION — existing ARKA schema aware
--
-- This version is designed for an EXISTING Supabase database.
-- In particular, the current ARKA schema already has:
--   public.profiles(id, full_name, role app_role, tenant_id, ...)
--   public.tenants(id, name, slug, status, created_at)
--   public.apps(...)
--
-- It preserves that schema/data and layers the new RBAC/onboarding model on top.
-- Run this file instead of the older 0001 migration.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Required enum types (created only when missing)
-- ------------------------------------------------------------

do $$ begin
  create type public.account_status as enum ('pending','active','suspended','disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tenant_status as enum ('onboarding','active','suspended','disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('invited','active','suspended','removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum ('pending','accepted','expired','revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.role_scope as enum ('platform','tenant');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 2. EXISTING PROFILES COMPATIBILITY
-- ------------------------------------------------------------
-- IMPORTANT: CREATE TABLE IF NOT EXISTS would NOT add columns to the
-- user's existing profiles table. Add only the columns the new ARKA
-- layer actually needs. Existing role app_role and tenant_id are retained.

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles add column if not exists email text;
    alter table public.profiles add column if not exists full_name text;
    alter table public.profiles add column if not exists avatar_url text;
    alter table public.profiles add column if not exists status text default 'pending';
    alter table public.profiles add column if not exists is_platform_user boolean default false;
    alter table public.profiles add column if not exists tenant_id uuid;
    alter table public.profiles add column if not exists created_at timestamptz default now();
    alter table public.profiles add column if not exists updated_at timestamptz default now();

    update public.profiles p
       set email = u.email
      from auth.users u
     where p.id = u.id
       and (p.email is null or btrim(p.email) = '');

    update public.profiles set status = 'pending' where status is null;
    update public.profiles set is_platform_user = false where is_platform_user is null;
    update public.profiles set created_at = now() where created_at is null;
    update public.profiles set updated_at = now() where updated_at is null;
  else
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      email text,
      full_name text,
      avatar_url text,
      status text default 'pending',
      is_platform_user boolean not null default false,
      tenant_id uuid,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. TENANTS — preserve existing table and add only missing fields
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.tenants') is not null then
    alter table public.tenants add column if not exists name text;
    alter table public.tenants add column if not exists slug text;
    alter table public.tenants add column if not exists status text default 'onboarding';
    alter table public.tenants add column if not exists settings jsonb default '{}'::jsonb;
    alter table public.tenants add column if not exists created_by uuid;
    alter table public.tenants add column if not exists updated_at timestamptz default now();
    update public.tenants set settings = '{}'::jsonb where settings is null;
    update public.tenants set status = 'onboarding' where status is null;
    update public.tenants set updated_at = now() where updated_at is null;
  else
    create table public.tenants (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text not null unique,
      status text not null default 'onboarding',
      settings jsonb not null default '{}'::jsonb,
      created_by uuid references public.profiles(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

-- Add the FK only when the existing tenant_id column is not already linked.
do $$
begin
  if to_regclass('public.profiles') is not null
     and to_regclass('public.tenants') is not null
     and not exists (
       select 1 from pg_constraint c
       where c.conrelid = 'public.profiles'::regclass
         and c.contype = 'f'
         and pg_get_constraintdef(c.oid) ilike '%tenant_id%public.tenants%'
     ) then
    begin
      alter table public.profiles
        add constraint profiles_tenant_id_fkey
        foreign key (tenant_id) references public.tenants(id) on delete set null;
    exception when duplicate_object then null;
             when foreign_key_violation then null;
    end;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. NEW RBAC TABLES
-- ------------------------------------------------------------

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  scope public.role_scope not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  is_system_role boolean not null default true,
  created_at timestamptz not null default now(),
  constraint roles_platform_tenant_check check (
    (scope = 'platform' and tenant_id is null)
    or (scope = 'tenant' and tenant_id is not null)
  )
);

create unique index if not exists roles_platform_code_unique
  on public.roles(code) where scope = 'platform';
create unique index if not exists roles_tenant_code_unique
  on public.roles(tenant_id, code) where scope = 'tenant';

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(resource, action)
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key(role_id, permission_id)
);

create table if not exists public.user_tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  status public.membership_status not null default 'invited',
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, tenant_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role_id uuid not null references public.roles(id),
  invited_by uuid references public.profiles(id) on delete set null,
  status public.invitation_status not null default 'pending',
  token_hash text,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  timezone text not null default 'UTC',
  data_region text,
  security_settings jsonb not null default '{}'::jsonb,
  ai_settings jsonb not null default '{}'::jsonb,
  notification_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_onboarding (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  organization_name text,
  business_vertical text,
  organization_size text,
  cloud_presence jsonb not null default '[]'::jsonb,
  security_technologies jsonb not null default '[]'::jsonb,
  security_stack jsonb not null default '{}'::jsonb,
  security_priorities jsonb not null default '[]'::jsonb,
  current_step smallint not null default 1,
  completed boolean not null default false,
  step_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. SEED ROLES + PERMISSIONS
-- ------------------------------------------------------------

insert into public.roles(code,name,description,scope,tenant_id,is_system_role)
select 'SUPER_ADMIN','Super Admin','Full ARKA platform access','platform',null,true
where not exists (
  select 1 from public.roles where code='SUPER_ADMIN' and scope='platform'
);

insert into public.permissions(resource,action,description) values
 ('platform','read','Read platform administration data'),
 ('platform','write','Manage platform administration data'),
 ('tenant','read','Read tenant data'),
 ('tenant','write','Manage tenant data'),
 ('users','read','View users'),
 ('users','write','Manage users and roles'),
 ('organization','read','View organization context'),
 ('organization','write','Manage organization context'),
 ('apps','read','View connected applications'),
 ('apps','write','Manage connected applications'),
 ('integrations','read','View integrations'),
 ('integrations','write','Manage integrations')
on conflict(resource,action) do nothing;

-- Create tenant-scoped roles for every existing tenant.
insert into public.roles(code,name,description,scope,tenant_id,is_system_role)
select r.code,r.name,r.description,'tenant'::public.role_scope,t.id,true
from public.tenants t
cross join (values
 ('TENANT_ADMIN','Tenant Admin','Full administration of one organization'),
 ('TENANT_USER','Tenant User','Standard organization access')
) r(code,name,description)
where not exists (
  select 1 from public.roles x
  where x.tenant_id=t.id and x.scope='tenant' and x.code=r.code
);

-- ------------------------------------------------------------
-- 6. MIGRATE THE USER'S EXISTING profiles.role + tenant_id
--    INTO THE NEW MEMBERSHIP MODEL.
-- ------------------------------------------------------------
-- The screenshot supplied for this ARKA installation shows the legacy
-- profile model: role app_role + tenant_id. We preserve it and backfill it.

do $$
declare
  has_role boolean;
  has_tenant_id boolean;
  role_sql text;
begin
  select exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='profiles' and column_name='role') into has_role;
  select exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='profiles' and column_name='tenant_id') into has_tenant_id;

  if has_role and has_tenant_id then
    role_sql := $q$
      insert into public.roles(code,name,description,scope,tenant_id,is_system_role)
      select 'TENANT_ADMIN','Tenant Admin','Full administration of one organization','tenant'::public.role_scope,p.tenant_id,true
      from public.profiles p
      where p.tenant_id is not null
        and lower(p.role::text) in ('tenant_admin','admin')
        and not exists (
          select 1 from public.roles r
          where r.tenant_id=p.tenant_id and r.scope='tenant' and r.code='TENANT_ADMIN'
        )
      group by p.tenant_id
    $q$;
    execute role_sql;

    role_sql := $q$
      insert into public.roles(code,name,description,scope,tenant_id,is_system_role)
      select 'TENANT_USER','Tenant User','Standard organization access','tenant'::public.role_scope,p.tenant_id,true
      from public.profiles p
      where p.tenant_id is not null
        and lower(p.role::text) in ('tenant_user','user','member')
        and not exists (
          select 1 from public.roles r
          where r.tenant_id=p.tenant_id and r.scope='tenant' and r.code='TENANT_USER'
        )
      group by p.tenant_id
    $q$;
    execute role_sql;

    execute $q$
      insert into public.user_tenant_memberships(user_id,tenant_id,role_id,status,joined_at)
      select p.id,p.tenant_id,r.id,'active'::public.membership_status,coalesce(p.created_at,now())
      from public.profiles p
      join public.roles r
        on r.tenant_id=p.tenant_id
       and r.scope='tenant'
       and r.code = case
         when lower(p.role::text) in ('tenant_admin','admin') then 'TENANT_ADMIN'
         when lower(p.role::text) in ('tenant_user','user','member') then 'TENANT_USER'
       end
      where p.tenant_id is not null
        and lower(p.role::text) in ('tenant_admin','admin','tenant_user','user','member')
      on conflict(user_id,tenant_id) do update set
        role_id=excluded.role_id,
        status='active'::public.membership_status,
        updated_at=now()
    $q$;

    execute $q$
      update public.profiles
         set is_platform_user=true,
             status='active'
       where lower(role::text) in ('super_admin','platform_admin','platform_adminstrator')
    $q$;
  end if;
end $$;

-- ------------------------------------------------------------
-- 7. EXISTING SUPER ADMIN BOOTSTRAP
-- ------------------------------------------------------------
-- Your current Auth account can also be explicitly promoted by running:
--   select public.provision_platform_admin('your-email@example.com');
--
-- We DO NOT hard-code a personal email in the migration.

create or replace function public.provision_platform_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid;
  has_role boolean;
  role_required boolean;
  admin_role text;
  sql text;
begin
  select id into v_user from auth.users
   where lower(email)=lower(btrim(p_email)) limit 1;
  if v_user is null then raise exception 'No Supabase Auth user exists for %',btrim(p_email); end if;

  select exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='profiles' and column_name='role') into has_role;
  select exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='profiles' and column_name='role' and is_nullable='NO') into role_required;

  if exists(select 1 from public.profiles where id=v_user) then
    update public.profiles p
       set email=u.email,
           full_name=coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',p.full_name),
           avatar_url=coalesce(u.raw_user_meta_data->>'avatar_url',p.avatar_url),
           status='active',
           is_platform_user=true,
           updated_at=now()
      from auth.users u where u.id=v_user;

    if has_role then
      select e.enumlabel into admin_role
      from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace
      where n.nspname='public' and t.typname='app_role'
        and lower(e.enumlabel) in ('super_admin','admin')
      order by case when lower(e.enumlabel)='super_admin' then 0 else 1 end limit 1;
      if admin_role is not null then
        sql := 'update public.profiles set role=$1::public.app_role where id=$2';
        execute sql using admin_role,v_user;
      end if;
    end if;
  else
    if has_role and role_required then
      select e.enumlabel into admin_role
      from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace
      where n.nspname='public' and t.typname='app_role'
        and lower(e.enumlabel) in ('super_admin','admin')
      order by case when lower(e.enumlabel)='super_admin' then 0 else 1 end limit 1;
      if admin_role is null then raise exception 'profiles.role requires an admin-compatible app_role value'; end if;
      sql := 'insert into public.profiles(id,email,full_name,avatar_url,status,is_platform_user,role) values ($1,$2,$3,$4,$5,$6,$7::public.app_role)';
      execute sql using v_user,(select email from auth.users where id=v_user),
        (select raw_user_meta_data->>'full_name' from auth.users where id=v_user),
        (select raw_user_meta_data->>'avatar_url' from auth.users where id=v_user),'active',true,admin_role;
    else
      insert into public.profiles(id,email,full_name,avatar_url,status,is_platform_user)
      select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name'),u.raw_user_meta_data->>'avatar_url','active',true
      from auth.users u where u.id=v_user;
    end if;
  end if;

  return v_user;
end;
$$;

revoke all on function public.provision_platform_admin(text) from public;
grant execute on function public.provision_platform_admin(text) to service_role;

-- ------------------------------------------------------------
-- 8. AUTH USER -> PROFILE
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  has_role boolean;
  role_required boolean;
  default_role text;
  sql text;
begin
  -- The existing ARKA schema has a NOT NULL `profiles.role app_role`.
  -- Keep that legacy column valid for new Auth users while the new
  -- membership model remains the authoritative access resolver.
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='role'
  ) into has_role;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='role'
      and is_nullable='NO'
  ) into role_required;

  if has_role and role_required then
    select e.enumlabel into default_role
    from pg_enum e
    join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='app_role'
      and lower(e.enumlabel) in ('user','tenant_user')
    order by case when lower(e.enumlabel)='user' then 0 else 1 end
    limit 1;

    if default_role is null then
      raise exception 'profiles.role is required, but no compatible app_role value (user/tenant_user) exists';
    end if;

    sql := 'insert into public.profiles(id,email,full_name,avatar_url,status,is_platform_user,role)
       values ($1,$2,$3,$4,$5,$6,$7::public.app_role)
       on conflict(id) do update set
         email=coalesce(excluded.email,public.profiles.email),
         full_name=coalesce(excluded.full_name,public.profiles.full_name),
         avatar_url=coalesce(excluded.avatar_url,public.profiles.avatar_url),
         updated_at=now()';
    execute sql using
      new.id,new.email,
      coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),
      new.raw_user_meta_data->>'avatar_url','pending',false,default_role;
  else
    insert into public.profiles(id,email,full_name,avatar_url,status,is_platform_user)
    values (
      new.id,new.email,
      coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),
      new.raw_user_meta_data->>'avatar_url','pending',false
    )
    on conflict(id) do update set
      email=coalesce(excluded.email,public.profiles.email),
      full_name=coalesce(excluded.full_name,public.profiles.full_name),
      avatar_url=coalesce(excluded.avatar_url,public.profiles.avatar_url),
      updated_at=now();
  end if;

  insert into public.user_preferences(user_id) values(new.id)
  on conflict(user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 9. ACCESS HELPERS
-- ------------------------------------------------------------

create or replace function public.current_user_id()
returns uuid language sql stable security invoker set search_path=public
as $$ select auth.uid(); $$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and coalesce(p.is_platform_user,false)=true
  )
  or exists(
    select 1
    from public.user_tenant_memberships m
    join public.roles r on r.id=m.role_id
    where m.user_id=auth.uid() and m.status='active'
      and r.scope='platform' and r.code='SUPER_ADMIN'
  );
$$;

create or replace function public.get_my_access_context()
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null then return null; end if;

  if public.is_super_admin() then
    select jsonb_build_object(
      'user_id',p.id,'email',coalesce(p.email,u.email,''),
      'full_name',coalesce(p.full_name,u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''),
      'tenant_id',null,'role','SUPER_ADMIN','role_name','Super Admin'
    ) into v_result
    from public.profiles p join auth.users u on u.id=p.id where p.id=v_user;
    return v_result;
  end if;

  select jsonb_build_object(
    'user_id',p.id,'email',coalesce(p.email,u.email,''),
    'full_name',coalesce(p.full_name,u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''),
    'tenant_id',m.tenant_id,'role',r.code,'role_name',r.name
  ) into v_result
  from public.profiles p
  join auth.users u on u.id=p.id
  join lateral (
    select m.* from public.user_tenant_memberships m
    where m.user_id=v_user and m.status='active'
    order by case when m.role_id in (select id from public.roles where code='TENANT_ADMIN' and scope='tenant') then 0 else 1 end,
             m.created_at asc
    limit 1
  ) m on true
  join public.roles r on r.id=m.role_id
  where p.id=v_user;

  return v_result;
end;
$$;

grant execute on function public.get_my_access_context() to authenticated;

create or replace function public.is_tenant_member(target_tenant uuid)
returns boolean language sql stable security definer set search_path=public
as $$
 select public.is_super_admin() or exists(
   select 1 from public.user_tenant_memberships m
   where m.user_id=auth.uid() and m.tenant_id=target_tenant and m.status='active'
 );
$$;

create or replace function public.is_tenant_admin(target_tenant uuid)
returns boolean language sql stable security definer set search_path=public
as $$
 select public.is_super_admin() or exists(
   select 1 from public.user_tenant_memberships m
   join public.roles r on r.id=m.role_id
   where m.user_id=auth.uid() and m.tenant_id=target_tenant and m.status='active'
     and r.scope='tenant' and r.code='TENANT_ADMIN'
 );
$$;

grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_tenant_admin(uuid) to authenticated;

-- ------------------------------------------------------------
-- 10. ONBOARDING RPC
-- ------------------------------------------------------------

create or replace function public.save_tenant_onboarding(
  p_organization_name text,
  p_business_vertical text,
  p_organization_size text default null,
  p_cloud_presence jsonb default '[]'::jsonb,
  p_security_technologies jsonb default '[]'::jsonb,
  p_security_stack jsonb default '{}'::jsonb,
  p_security_priorities jsonb default '[]'::jsonb,
  p_step smallint default 1,
  p_step_data jsonb default '{}'::jsonb,
  p_completed boolean default false
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_tenant_id uuid;
  v_role_id uuid;
  v_membership_id uuid;
  v_slug text;
  v_onboarding_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if public.is_super_admin() then raise exception 'Platform admins cannot complete tenant onboarding'; end if;
  if p_organization_name is null or btrim(p_organization_name)='' then raise exception 'Organization name is required'; end if;
  if p_business_vertical is null or btrim(p_business_vertical)='' then raise exception 'Business vertical is required'; end if;

  -- Existing Tenant Admin resumes onboarding; a fresh signup has no tenant.
  select m.tenant_id,m.role_id,m.id into v_tenant_id,v_role_id,v_membership_id
  from public.user_tenant_memberships m
  join public.roles r on r.id=m.role_id
  where m.user_id=v_user and m.status='active'
    and r.scope='tenant' and r.code='TENANT_ADMIN'
  limit 1;

  if v_tenant_id is null then
    -- A user with an existing Tenant User membership is never allowed to bootstrap a tenant.
    if exists(
      select 1 from public.user_tenant_memberships m
      join public.roles r on r.id=m.role_id
      where m.user_id=v_user and m.status='active' and r.code='TENANT_USER'
    ) then raise exception 'Tenant users cannot complete organization onboarding'; end if;

    v_slug:=lower(regexp_replace(btrim(p_organization_name),'[^a-zA-Z0-9]+','-','g'));
    v_slug:=trim(both '-' from v_slug);
    if v_slug='' then v_slug:='organization'; end if;
    if exists(select 1 from public.tenants where slug=v_slug) then
      v_slug:=left(v_slug,42)||'-'||substr(v_user::text,1,8);
    end if;

    insert into public.tenants(name,slug,status,settings,created_by)
    values(btrim(p_organization_name),v_slug,case when p_completed then 'active' else 'onboarding' end,
           jsonb_build_object('organization_size',coalesce(p_organization_size,'')),v_user)
    returning id into v_tenant_id;

    insert into public.roles(code,name,description,scope,tenant_id,is_system_role)
    values('TENANT_ADMIN','Tenant Admin','Full administration of one organization','tenant',v_tenant_id,true)
    returning id into v_role_id;

    insert into public.roles(code,name,description,scope,tenant_id,is_system_role)
    values('TENANT_USER','Tenant User','Standard organization access','tenant',v_tenant_id,true)
    on conflict do nothing;

    insert into public.user_tenant_memberships(user_id,tenant_id,role_id,status,joined_at)
    values(v_user,v_tenant_id,v_role_id,'active',now())
    returning id into v_membership_id;

    update public.profiles set tenant_id=v_tenant_id,status='active',updated_at=now() where id=v_user;
  end if;

  insert into public.tenant_settings(tenant_id) values(v_tenant_id)
  on conflict(tenant_id) do nothing;

  insert into public.tenant_onboarding(
    tenant_id,organization_name,business_vertical,organization_size,
    cloud_presence,security_technologies,security_stack,security_priorities,
    current_step,completed,step_data
  ) values(
    v_tenant_id,btrim(p_organization_name),btrim(p_business_vertical),p_organization_size,
    coalesce(p_cloud_presence,'[]'::jsonb),coalesce(p_security_technologies,'[]'::jsonb),
    coalesce(p_security_stack,'{}'::jsonb),coalesce(p_security_priorities,'[]'::jsonb),
    greatest(1,p_step),p_completed,coalesce(p_step_data,'{}'::jsonb)
  )
  on conflict(tenant_id) do update set
    organization_name=excluded.organization_name,
    business_vertical=excluded.business_vertical,
    organization_size=excluded.organization_size,
    cloud_presence=excluded.cloud_presence,
    security_technologies=excluded.security_technologies,
    security_stack=excluded.security_stack,
    security_priorities=excluded.security_priorities,
    current_step=excluded.current_step,
    completed=excluded.completed,
    step_data=excluded.step_data,
    updated_at=now()
  returning id into v_onboarding_id;

  if p_completed then
    update public.tenants set status='active',updated_at=now() where id=v_tenant_id;
  end if;

  return jsonb_build_object(
    'tenant_id',v_tenant_id,
    'membership_id',v_membership_id,
    'onboarding_id',v_onboarding_id,
    'role','TENANT_ADMIN',
    'completed',p_completed
  );
end;
$$;

grant execute on function public.save_tenant_onboarding(text,text,text,jsonb,jsonb,jsonb,jsonb,smallint,jsonb,boolean) to authenticated;

-- ------------------------------------------------------------
-- 11. TRIGGERS + RLS
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path=public
as $$ begin new.updated_at=now(); return new; end; $$;

do $$ begin
  drop trigger if exists profiles_updated_at on public.profiles;
  create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
exception when undefined_table then null; end $$;

do $$ begin
  drop trigger if exists tenants_updated_at on public.tenants;
  create trigger tenants_updated_at before update on public.tenants for each row execute function public.set_updated_at();
exception when undefined_table then null; end $$;

do $$ begin
  drop trigger if exists memberships_updated_at on public.user_tenant_memberships;
  create trigger memberships_updated_at before update on public.user_tenant_memberships for each row execute function public.set_updated_at();
exception when undefined_table then null; end $$;

do $$ begin
  drop trigger if exists tenant_settings_updated_at on public.tenant_settings;
  create trigger tenant_settings_updated_at before update on public.tenant_settings for each row execute function public.set_updated_at();
exception when undefined_table then null; end $$;

do $$ begin
  drop trigger if exists user_preferences_updated_at on public.user_preferences;
  create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
exception when undefined_table then null; end $$;

do $$ begin
  drop trigger if exists tenant_onboarding_updated_at on public.tenant_onboarding;
  create trigger tenant_onboarding_updated_at before update on public.tenant_onboarding for each row execute function public.set_updated_at();
exception when undefined_table then null; end $$;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_tenant_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_logs enable row level security;
alter table public.tenant_onboarding enable row level security;

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile" on public.profiles for select to authenticated
using(id=auth.uid() or public.is_super_admin());

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles for update to authenticated
using(id=auth.uid()) with check(id=auth.uid());

drop policy if exists "tenant members read tenant" on public.tenants;
create policy "tenant members read tenant" on public.tenants for select to authenticated
using(public.is_tenant_member(id));

drop policy if exists "super admin manage tenants" on public.tenants;
create policy "super admin manage tenants" on public.tenants for all to authenticated
using(public.is_super_admin()) with check(public.is_super_admin());

drop policy if exists "members read memberships" on public.user_tenant_memberships;
create policy "members read memberships" on public.user_tenant_memberships for select to authenticated
using(user_id=auth.uid() or public.is_tenant_admin(tenant_id) or public.is_super_admin());

drop policy if exists "admins manage memberships" on public.user_tenant_memberships;
create policy "admins manage memberships" on public.user_tenant_memberships for all to authenticated
using(public.is_tenant_admin(tenant_id)) with check(public.is_tenant_admin(tenant_id));

drop policy if exists "members read onboarding" on public.tenant_onboarding;
create policy "members read onboarding" on public.tenant_onboarding for select to authenticated
using(public.is_tenant_member(tenant_id));

drop policy if exists "admins manage onboarding" on public.tenant_onboarding;
create policy "admins manage onboarding" on public.tenant_onboarding for all to authenticated
using(public.is_tenant_admin(tenant_id)) with check(public.is_tenant_admin(tenant_id));

drop policy if exists "members read tenant settings" on public.tenant_settings;
create policy "members read tenant settings" on public.tenant_settings for select to authenticated
using(public.is_tenant_member(tenant_id));

drop policy if exists "admins manage tenant settings" on public.tenant_settings;
create policy "admins manage tenant settings" on public.tenant_settings for all to authenticated
using(public.is_tenant_admin(tenant_id)) with check(public.is_tenant_admin(tenant_id));

drop policy if exists "users read own preferences" on public.user_preferences;
create policy "users read own preferences" on public.user_preferences for select to authenticated
using(user_id=auth.uid());
drop policy if exists "users manage own preferences" on public.user_preferences;
create policy "users manage own preferences" on public.user_preferences for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists "members read roles" on public.roles;
create policy "members read roles" on public.roles for select to authenticated
using(scope='platform' and public.is_super_admin() or scope='tenant' and public.is_tenant_member(tenant_id));

drop policy if exists "members read permissions" on public.permissions;
create policy "members read permissions" on public.permissions for select to authenticated
using(public.is_super_admin() or exists(select 1 from public.role_permissions rp join public.roles r on r.id=rp.role_id where rp.permission_id=permissions.id and r.scope='tenant' and public.is_tenant_member(r.tenant_id)));

drop policy if exists "members read role permissions" on public.role_permissions;
create policy "members read role permissions" on public.role_permissions for select to authenticated
using(public.is_super_admin() or exists(select 1 from public.roles r where r.id=role_permissions.role_id and r.scope='tenant' and public.is_tenant_member(r.tenant_id)));

drop policy if exists "members read invitations" on public.invitations;
create policy "members read invitations" on public.invitations for select to authenticated
using(public.is_tenant_admin(tenant_id) or public.is_super_admin());

drop policy if exists "admins manage invitations" on public.invitations;
create policy "admins manage invitations" on public.invitations for all to authenticated
using(public.is_tenant_admin(tenant_id) or public.is_super_admin())
with check(public.is_tenant_admin(tenant_id) or public.is_super_admin());

drop policy if exists "members read audit logs" on public.audit_logs;
create policy "members read audit logs" on public.audit_logs for select to authenticated
using(public.is_super_admin() or (tenant_id is not null and public.is_tenant_member(tenant_id)));

-- ------------------------------------------------------------
-- 12. BOOTSTRAP YOUR CURRENT ADMIN ACCOUNT
-- ------------------------------------------------------------
-- The migration intentionally does not contain a personal email.
-- After this migration succeeds, run ONE explicit command in Supabase SQL:
--
--   select public.provision_platform_admin('YOUR_AUTH_EMAIL');
--
-- This is the only step needed to make the first platform admin.

commit;
