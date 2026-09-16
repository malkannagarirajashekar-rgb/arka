-- ============================================================
-- ARKA Identity + Multi-Tenant RBAC Foundation
-- Supabase / PostgreSQL
-- Migration: 001_identity_rbac.sql
-- ============================================================

begin;

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

do $$
begin

    create type public.account_status as enum (
        'pending',
        'active',
        'suspended',
        'disabled'
    );

exception
    when duplicate_object then null;
end $$;


do $$
begin

    create type public.tenant_status as enum (
        'onboarding',
        'active',
        'suspended',
        'disabled'
    );

exception
    when duplicate_object then null;
end $$;


do $$
begin

    create type public.membership_status as enum (
        'invited',
        'active',
        'suspended',
        'removed'
    );

exception
    when duplicate_object then null;
end $$;


do $$
begin

    create type public.invitation_status as enum (
        'pending',
        'accepted',
        'expired',
        'revoked'
    );

exception
    when duplicate_object then null;
end $$;


do $$
begin

    create type public.role_scope as enum (
        'platform',
        'tenant'
    );

exception
    when duplicate_object then null;
end $$;



-- ============================================================
-- 1A. COMPATIBILITY LAYER FOR EXISTING ARKA INSTALLATIONS
-- ============================================================
-- This migration is intentionally safe for a partially-created database.
-- CREATE TABLE IF NOT EXISTS does not add columns to an existing table, so
-- missing columns are added here before any ARKA function references them.

DO $$
BEGIN
    -- profiles
    IF to_regclass('public.profiles') IS NOT NULL THEN
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_platform_user boolean DEFAULT false;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

        UPDATE public.profiles p
        SET email = u.email
        FROM auth.users u
        WHERE p.id = u.id AND (p.email IS NULL OR btrim(p.email) = '');

        UPDATE public.profiles SET status = 'pending' WHERE status IS NULL;
        UPDATE public.profiles SET is_platform_user = false WHERE is_platform_user IS NULL;
        UPDATE public.profiles SET created_at = now() WHERE created_at IS NULL;
        UPDATE public.profiles SET updated_at = now() WHERE updated_at IS NULL;
    END IF;

    -- tenants
    IF to_regclass('public.tenants') IS NOT NULL THEN
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS name text;
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug text;
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status text DEFAULT 'onboarding';
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS created_by uuid;
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
        UPDATE public.tenants SET settings='{}'::jsonb WHERE settings IS NULL;
        UPDATE public.tenants SET status='onboarding' WHERE status IS NULL;
        UPDATE public.tenants SET slug='tenant-' || id::text WHERE slug IS NULL OR btrim(slug)='';
        UPDATE public.tenants SET created_at=now() WHERE created_at IS NULL;
        UPDATE public.tenants SET updated_at=now() WHERE updated_at IS NULL;
    END IF;

    -- roles
    IF to_regclass('public.roles') IS NOT NULL THEN
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS code text;
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS name text;
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS description text;
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS scope text DEFAULT 'tenant';
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS tenant_id uuid;
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS is_system_role boolean DEFAULT true;
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
        UPDATE public.roles SET code=upper(regexp_replace(coalesce(name,'ROLE-'||id::text),'[^A-Za-z0-9_]+','_','g')) WHERE code IS NULL OR btrim(code)='';
        UPDATE public.roles SET name=initcap(replace(lower(coalesce(code,'role')),'_',' ')) WHERE name IS NULL OR btrim(name)='';
        UPDATE public.roles SET scope=case when upper(coalesce(code,''))='SUPER_ADMIN' then 'platform' else 'tenant' end WHERE scope IS NULL OR btrim(scope)='';
        UPDATE public.roles SET is_system_role=true WHERE is_system_role IS NULL;
        UPDATE public.roles SET created_at=now() WHERE created_at IS NULL;
    END IF;

    -- permissions
    IF to_regclass('public.permissions') IS NOT NULL THEN
        ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS resource text;
        ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS action text;
        ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS description text;
        ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
        UPDATE public.permissions SET resource=coalesce(resource,'platform') WHERE resource IS NULL;
        UPDATE public.permissions SET action=coalesce(action,'read') WHERE action IS NULL;
        UPDATE public.permissions SET created_at=now() WHERE created_at IS NULL;
    END IF;

    -- user_tenant_memberships
    IF to_regclass('public.user_tenant_memberships') IS NOT NULL THEN
        ALTER TABLE public.user_tenant_memberships ADD COLUMN IF NOT EXISTS user_id uuid;
        ALTER TABLE public.user_tenant_memberships ADD COLUMN IF NOT EXISTS tenant_id uuid;
        ALTER TABLE public.user_tenant_memberships ADD COLUMN IF NOT EXISTS role_id uuid;
        ALTER TABLE public.user_tenant_memberships ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
        ALTER TABLE public.user_tenant_memberships ADD COLUMN IF NOT EXISTS invited_by uuid;
        ALTER TABLE public.user_tenant_memberships ADD COLUMN IF NOT EXISTS joined_at timestamptz;
        ALTER TABLE public.user_tenant_memberships ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
        ALTER TABLE public.user_tenant_memberships ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    END IF;

    -- invitations
    IF to_regclass('public.invitations') IS NOT NULL THEN
        ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS tenant_id uuid;
        ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS email text;
        ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS role_id uuid;
        ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS invited_by uuid;
        ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
        ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS token_hash text;
        ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT now() + interval '7 days';
        ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
        ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
    END IF;

    -- tenant_settings
    IF to_regclass('public.tenant_settings') IS NOT NULL THEN
        ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS tenant_id uuid;
        ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';
        ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS data_region text;
        ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS security_settings jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS ai_settings jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
        ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    END IF;

    -- user_preferences
    IF to_regclass('public.user_preferences') IS NOT NULL THEN
        ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS user_id uuid;
        ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
        ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    END IF;

    -- audit_logs
    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id uuid;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action text;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource_type text;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource_id uuid;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address inet;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
    END IF;
END $$;

-- ============================================================
-- 2. PROFILES
-- ============================================================

create table if not exists public.profiles (

    id uuid primary key
        references auth.users(id)
        on delete cascade,

    email text not null,

    full_name text,

    avatar_url text,

    status public.account_status
        not null default 'pending',

    is_platform_user boolean
        not null default false,

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now()

);


-- ============================================================
-- 3. TENANTS
-- ============================================================

create table if not exists public.tenants (

    id uuid primary key
        default gen_random_uuid(),

    name text not null,

    slug text not null unique,

    status public.tenant_status
        not null default 'onboarding',

    settings jsonb
        not null default '{}'::jsonb,

    created_by uuid
        references public.profiles(id)
        on delete set null,

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now()

);


-- ============================================================
-- 4. ROLES
-- ============================================================

create table if not exists public.roles (

    id uuid primary key
        default gen_random_uuid(),

    code text not null,

    name text not null,

    description text,

    scope public.role_scope
        not null,

    tenant_id uuid
        references public.tenants(id)
        on delete cascade,

    is_system_role boolean
        not null default true,

    created_at timestamptz
        not null default now(),

    constraint roles_platform_tenant_check
        check (
            (scope = 'platform' and tenant_id is null)
            or
            (scope = 'tenant' and tenant_id is not null)
        )

);


create unique index if not exists
roles_platform_code_unique
on public.roles(code)
where scope = 'platform';


create unique index if not exists
roles_tenant_code_unique
on public.roles(tenant_id, code)
where scope = 'tenant';


-- ============================================================
-- 5. PERMISSIONS
-- ============================================================

create table if not exists public.permissions (

    id uuid primary key
        default gen_random_uuid(),

    resource text not null,

    action text not null,

    description text,

    created_at timestamptz
        not null default now(),

    unique(resource, action)

);


-- ============================================================
-- 6. ROLE → PERMISSION
-- ============================================================

create table if not exists public.role_permissions (

    role_id uuid not null
        references public.roles(id)
        on delete cascade,

    permission_id uuid not null
        references public.permissions(id)
        on delete cascade,

    primary key(role_id, permission_id)

);


-- ============================================================
-- 7. USER → TENANT MEMBERSHIP
-- This table is required by every access/RLS helper below. It is created before
-- any function that references it, preventing relation-not-found failures.
-- ============================================================

create table if not exists public.user_tenant_memberships (

    id uuid primary key
        default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    tenant_id uuid not null
        references public.tenants(id)
        on delete cascade,

    role_id uuid not null
        references public.roles(id),

    status public.membership_status
        not null default 'invited',

    invited_by uuid
        references public.profiles(id)
        on delete set null,

    joined_at timestamptz,

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now(),

    unique(user_id, tenant_id)

);


-- ============================================================
-- 8. INVITATIONS
-- ============================================================

create table if not exists public.invitations (

    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid not null
        references public.tenants(id)
        on delete cascade,

    email text not null,

    role_id uuid not null
        references public.roles(id),

    invited_by uuid not null
        references public.profiles(id)
        on delete restrict,

    status public.invitation_status
        not null default 'pending',

    token_hash text not null,

    expires_at timestamptz not null,

    accepted_at timestamptz,

    created_at timestamptz
        not null default now()

);


create unique index if not exists
invitations_pending_email_unique
on public.invitations(tenant_id, lower(email))
where status = 'pending';


create index if not exists
invitations_token_hash_idx
on public.invitations(token_hash);


-- ============================================================
-- 9. TENANT SETTINGS
-- ============================================================

create table if not exists public.tenant_settings (

    tenant_id uuid primary key
        references public.tenants(id)
        on delete cascade,

    timezone text
        not null default 'UTC',

    data_region text,

    security_settings jsonb
        not null default '{}'::jsonb,

    ai_settings jsonb
        not null default '{}'::jsonb,

    notification_settings jsonb
        not null default '{}'::jsonb,

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now()

);


-- ============================================================
-- 10. USER PREFERENCES
-- ============================================================

create table if not exists public.user_preferences (

    user_id uuid primary key
        references public.profiles(id)
        on delete cascade,

    preferences jsonb
        not null default '{}'::jsonb,

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now()

);


-- ============================================================
-- 11. AUDIT LOG
-- ============================================================

create table if not exists public.audit_logs (

    id uuid primary key
        default gen_random_uuid(),

    tenant_id uuid
        references public.tenants(id)
        on delete set null,

    actor_id uuid
        references public.profiles(id)
        on delete set null,

    action text not null,

    resource_type text,

    resource_id uuid,

    metadata jsonb
        not null default '{}'::jsonb,

    ip_address inet,

    user_agent text,

    created_at timestamptz
        not null default now()

);


create index if not exists
audit_logs_tenant_idx
on public.audit_logs(tenant_id, created_at desc);


create index if not exists
audit_logs_actor_idx
on public.audit_logs(actor_id, created_at desc);


-- ============================================================
-- 12. UPDATED_AT FUNCTION
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


-- ============================================================
-- 13. UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists profiles_updated_at
on public.profiles;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists tenants_updated_at
on public.tenants;

create trigger tenants_updated_at
before update on public.tenants
for each row
execute function public.set_updated_at();


drop trigger if exists memberships_updated_at
on public.user_tenant_memberships;

create trigger memberships_updated_at
before update on public.user_tenant_memberships
for each row
execute function public.set_updated_at();


drop trigger if exists tenant_settings_updated_at
on public.tenant_settings;

create trigger tenant_settings_updated_at
before update on public.tenant_settings
for each row
execute function public.set_updated_at();


drop trigger if exists user_preferences_updated_at
on public.user_preferences;

create trigger user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();


-- ============================================================
-- 14. NEW USER → PROFILE
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    insert into public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        status
    )
    values (
        new.id,
        new.email,
        coalesce(
            new.raw_user_meta_data ->> 'full_name',
            new.raw_user_meta_data ->> 'name'
        ),
        new.raw_user_meta_data ->> 'avatar_url',
        'pending'
    )
    on conflict (id)
    do update set
        email = excluded.email,
        updated_at = now();

    insert into public.user_preferences(user_id)
    values(new.id)
    on conflict(user_id) do nothing;

    return new;

end;
$$;


drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- ============================================================
-- 15A. PLATFORM ADMIN BOOTSTRAP (SERVICE ROLE / SQL EDITOR ONLY)
-- ============================================================
-- The public signup flow can never grant SUPER_ADMIN. Provision the first
-- platform administrator explicitly from the Supabase SQL editor or a trusted
-- service-role backend, then all additional platform admins are created by an
-- existing Super Admin through the application.

create or replace function public.provision_platform_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    if p_email is null or btrim(p_email) = '' then
        raise exception 'Administrator email is required';
    end if;

    select id into v_user_id
    from auth.users
    where lower(email) = lower(btrim(p_email))
    limit 1;

    if v_user_id is null then
        raise exception 'No Supabase Auth user exists for %', btrim(p_email);
    end if;

    insert into public.profiles(id, email, full_name, avatar_url, status, is_platform_user)
    select
        u.id,
        coalesce(u.email, btrim(p_email)),
        coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
        u.raw_user_meta_data ->> 'avatar_url',
        'active'::public.account_status,
        true
    from auth.users u
    where u.id = v_user_id
    on conflict (id) do update set
        email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        status = 'active'::public.account_status,
        is_platform_user = true,
        updated_at = now();

    return v_user_id;
end;
$$;

revoke all on function public.provision_platform_admin(text) from public;
grant execute on function public.provision_platform_admin(text) to service_role;

-- ============================================================
-- 15. HELPER: CURRENT USER
-- ============================================================

create or replace function public.current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
    select auth.uid();
$$;


-- ============================================================
-- 16. HELPER: IS SUPER ADMIN
-- ============================================================

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$

    select exists (
        select 1
        from public.user_tenant_memberships m
        join public.roles r
            on r.id = m.role_id
        where m.user_id = auth.uid()
          and m.status = 'active'
          and r.code = 'SUPER_ADMIN'
          and r.scope = 'platform'
    )
    or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and (
              coalesce(p.is_platform_user, false) = true
          )
    );

$$;


-- ============================================================
-- 16A. SECURE ACCESS CONTEXT FOR CLIENT ROUTING
-- ============================================================

create or replace function public.get_my_access_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_result jsonb;
begin
    if v_user is null then
        return null;
    end if;

    if exists (
        select 1 from public.profiles p
        where p.id = v_user and p.is_platform_user = true
    ) then
        select jsonb_build_object(
            'user_id', p.id,
            'email', p.email,
            'full_name', coalesce(p.full_name, ''),
            'tenant_id', null,
            'role', 'SUPER_ADMIN',
            'role_name', 'Super Admin'
        )
        into v_result
        from public.profiles p
        where p.id = v_user;
        return v_result;
    end if;

    -- A platform SUPER_ADMIN membership must take precedence over any tenant
    -- membership. This prevents the client from ever seeing a platform admin
    -- as a pending Tenant Admin because an older tenant membership exists.
    if exists (
        select 1
        from public.user_tenant_memberships m
        join public.roles r on r.id = m.role_id
        where m.user_id = v_user
          and m.status = 'active'
          and r.code = 'SUPER_ADMIN'
          and r.scope = 'platform'
    ) then
        select jsonb_build_object(
            'user_id', p.id,
            'email', p.email,
            'full_name', coalesce(p.full_name, ''),
            'tenant_id', null,
            'role', 'SUPER_ADMIN',
            'role_name', 'Super Admin'
        )
        into v_result
        from public.profiles p
        where p.id = v_user;
        return v_result;
    end if;

    select jsonb_build_object(
        'user_id', v_user,
        'email', p.email,
        'full_name', coalesce(p.full_name, ''),
        'tenant_id', m.tenant_id,
        'role', r.code,
        'role_name', r.name
    )
    into v_result
    from public.profiles p
    left join lateral (
        select m.tenant_id, m.role_id
        from public.user_tenant_memberships m
        where m.user_id = v_user
          and m.status = 'active'
        order by m.created_at asc
        limit 1
    ) m on true
    left join public.roles r on r.id = m.role_id
    where p.id = v_user;

    return v_result;
end;
$$;

revoke all on function public.get_my_access_context() from public;
grant execute on function public.get_my_access_context() to authenticated;

-- ============================================================
-- 17. HELPER: TENANT MEMBERSHIP
-- ============================================================

create or replace function public.is_tenant_member(
    target_tenant uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$

    select
        public.is_super_admin()
        or exists (
            select 1
            from public.user_tenant_memberships m
            where m.user_id = auth.uid()
              and m.tenant_id = target_tenant
              and m.status = 'active'
        );

$$;


-- ============================================================
-- 18. HELPER: TENANT ADMIN
-- ============================================================

create or replace function public.is_tenant_admin(
    target_tenant uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$

    select
        public.is_super_admin()
        or exists (
            select 1
            from public.user_tenant_memberships m
            join public.roles r
                on r.id = m.role_id
            where m.user_id = auth.uid()
              and m.tenant_id = target_tenant
              and m.status = 'active'
              and r.code = 'TENANT_ADMIN'
              and r.scope = 'tenant'
        );

$$;


-- ============================================================
-- 19. GENERIC PERMISSION CHECK
-- ============================================================

create or replace function public.has_permission(
    target_tenant uuid,
    target_resource text,
    target_action text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$

    select
        public.is_super_admin()
        or exists (

            select 1

            from public.user_tenant_memberships m

            join public.roles r
                on r.id = m.role_id

            join public.role_permissions rp
                on rp.role_id = r.id

            join public.permissions p
                on p.id = rp.permission_id

            where m.user_id = auth.uid()
              and m.tenant_id = target_tenant
              and m.status = 'active'
              and p.resource = target_resource
              and p.action = target_action
        );

$$;


-- ============================================================
-- 20. SEED PERMISSIONS
-- ============================================================

insert into public.permissions(resource, action, description)
values

-- Platform
('platform', 'read', 'View platform configuration'),
('platform', 'manage', 'Manage ARKA platform'),

-- Tenants
('tenant', 'read', 'View tenant'),
('tenant', 'create', 'Create tenant'),
('tenant', 'update', 'Update tenant'),
('tenant', 'delete', 'Delete tenant'),
('tenant', 'manage', 'Manage tenant'),

-- Users
('users', 'read', 'View users'),
('users', 'invite', 'Invite users'),
('users', 'update', 'Update users'),
('users', 'disable', 'Disable users'),
('users', 'delete', 'Delete users'),

-- Roles
('roles', 'read', 'View roles'),
('roles', 'manage', 'Manage roles'),

-- Integrations
('integrations', 'read', 'View integrations'),
('integrations', 'manage', 'Manage integrations'),

-- Alerts
('alerts', 'read', 'View alerts'),
('alerts', 'create', 'Create alerts'),
('alerts', 'update', 'Update alerts'),
('alerts', 'manage', 'Manage alerts'),

-- Investigations
('investigations', 'read', 'View investigations'),
('investigations', 'create', 'Create investigations'),
('investigations', 'update', 'Update investigations'),

-- Dashboards
('dashboards', 'read', 'View dashboards'),
('dashboards', 'create', 'Create dashboards'),
('dashboards', 'update', 'Update dashboards'),
('dashboards', 'delete', 'Delete dashboards'),

-- Workflows
('workflows', 'read', 'View workflows'),
('workflows', 'create', 'Create workflows'),
('workflows', 'update', 'Update workflows'),
('workflows', 'execute', 'Execute workflows'),

-- Audit
('audit', 'read', 'View audit logs')

on conflict(resource, action)
do nothing;


-- ============================================================
-- 21. SEED SYSTEM ROLES
-- ============================================================

insert into public.roles(
    code,
    name,
    description,
    scope,
    tenant_id,
    is_system_role
)
values

(
    'SUPER_ADMIN',
    'Super Admin',
    'Full ARKA platform access',
    'platform',
    null,
    true
)

on conflict do nothing;


-- Tenant roles are templates.
-- They can be copied/created per tenant during tenant onboarding.

-- ============================================================
-- 22. CONNECT SUPER ADMIN → ALL PLATFORM PERMISSIONS
-- ============================================================

insert into public.role_permissions(role_id, permission_id)

select
    r.id,
    p.id

from public.roles r
cross join public.permissions p

where r.code = 'SUPER_ADMIN'
  and r.scope = 'platform'

on conflict do nothing;


-- ============================================================
-- 23. RLS
-- ============================================================

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


-- ============================================================
-- 24. PROFILE POLICIES
-- ============================================================

drop policy if exists "users can read own profile" on public.profiles;

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
    or public.is_super_admin()
);


drop policy if exists "users can update own profile" on public.profiles;

create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (
    id = auth.uid()
)
with check (
    id = auth.uid()
);


drop policy if exists "super admin can manage profiles" on public.profiles;

create policy "super admin can manage profiles"
on public.profiles
for all
to authenticated
using (
    public.is_super_admin()
)
with check (
    public.is_super_admin()
);


-- ============================================================
-- 25. TENANT POLICIES
-- ============================================================

drop policy if exists "members can read tenant" on public.tenants;

create policy "members can read tenant"
on public.tenants
for select
to authenticated
using (
    public.is_tenant_member(id)
);


drop policy if exists "super admin can manage tenants" on public.tenants;

create policy "super admin can manage tenants"
on public.tenants
for all
to authenticated
using (
    public.is_super_admin()
)
with check (
    public.is_super_admin()
);


drop policy if exists "tenant admins can update tenant" on public.tenants;

create policy "tenant admins can update tenant"
on public.tenants
for update
to authenticated
using (
    public.is_tenant_admin(id)
)
with check (
    public.is_tenant_admin(id)
);


-- ============================================================
-- 26. MEMBERSHIP POLICIES
-- ============================================================

drop policy if exists "users can view own memberships" on public.user_tenant_memberships;

create policy "users can view own memberships"
on public.user_tenant_memberships
for select
to authenticated
using (
    user_id = auth.uid()
    or public.is_tenant_admin(tenant_id)
);


drop policy if exists "tenant admins manage memberships" on public.user_tenant_memberships;

create policy "tenant admins manage memberships"
on public.user_tenant_memberships
for all
to authenticated
using (
    public.is_tenant_admin(tenant_id)
)
with check (
    public.is_tenant_admin(tenant_id)
);


drop policy if exists "super admin manages memberships" on public.user_tenant_memberships;

create policy "super admin manages memberships"
on public.user_tenant_memberships
for all
to authenticated
using (
    public.is_super_admin()
)
with check (
    public.is_super_admin()
);


-- ============================================================
-- 27. TENANT SETTINGS
-- ============================================================

drop policy if exists "members read tenant settings" on public.tenant_settings;

create policy "members read tenant settings"
on public.tenant_settings
for select
to authenticated
using (
    public.is_tenant_member(tenant_id)
);


drop policy if exists "tenant admin manages settings" on public.tenant_settings;

create policy "tenant admin manages settings"
on public.tenant_settings
for all
to authenticated
using (
    public.is_tenant_admin(tenant_id)
)
with check (
    public.is_tenant_admin(tenant_id)
);


-- ============================================================
-- 28. USER PREFERENCES
-- ============================================================

drop policy if exists "users manage own preferences" on public.user_preferences;

create policy "users manage own preferences"
on public.user_preferences
for all
to authenticated
using (
    user_id = auth.uid()
)
with check (
    user_id = auth.uid()
);


-- ============================================================
-- 29. INVITATIONS
-- ============================================================

drop policy if exists "tenant admins manage invitations" on public.invitations;

create policy "tenant admins manage invitations"
on public.invitations
for all
to authenticated
using (
    public.is_tenant_admin(tenant_id)
)
with check (
    public.is_tenant_admin(tenant_id)
);


-- ============================================================
-- 30. AUDIT LOGS
-- ============================================================

drop policy if exists "tenant members read tenant audit" on public.audit_logs;

create policy "tenant members read tenant audit"
on public.audit_logs
for select
to authenticated
using (
    public.is_tenant_member(tenant_id)
);


drop policy if exists "super admin read all audit" on public.audit_logs;

create policy "super admin read all audit"
on public.audit_logs
for select
to authenticated
using (
    public.is_super_admin()
);


-- ============================================================
-- 31. PERMISSIONS ARE READ-ONLY TO APPLICATION USERS
-- ============================================================

drop policy if exists "authenticated users can read permissions" on public.permissions;

create policy "authenticated users can read permissions"
on public.permissions
for select
to authenticated
using (true);


drop policy if exists "authenticated users can read roles" on public.roles;

create policy "authenticated users can read roles"
on public.roles
for select
to authenticated
using (
    scope = 'platform'
    or tenant_id is null
    or public.is_tenant_member(tenant_id)
);


drop policy if exists "authenticated users can read role permissions" on public.role_permissions;

create policy "authenticated users can read role permissions"
on public.role_permissions
for select
to authenticated
using (
    exists (
        select 1
        from public.roles r
        where r.id = role_permissions.role_id
          and (
              r.scope = 'platform'
              or r.tenant_id is null
              or public.is_tenant_member(r.tenant_id)
          )
    )
);


-- ============================================================
-- 32. INDEXES
-- ============================================================

create index if not exists
memberships_user_idx
on public.user_tenant_memberships(user_id);

create index if not exists
memberships_tenant_idx
on public.user_tenant_memberships(tenant_id);

create index if not exists
memberships_role_idx
on public.user_tenant_memberships(role_id);

create index if not exists
profiles_status_idx
on public.profiles(status);

create index if not exists
tenants_status_idx
on public.tenants(status);




-- ============================================================
-- 33A. WORKSPACE / ONBOARDING COMPATIBILITY
-- ============================================================
DO $$
BEGIN
    IF to_regclass('public.workspaces') IS NOT NULL THEN
        ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS tenant_id uuid;
        ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS name text;
        ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS slug text;
        ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
        ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
        ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
        ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
        UPDATE public.workspaces SET settings='{}'::jsonb WHERE settings IS NULL;
        UPDATE public.workspaces SET status='active' WHERE status IS NULL;
        UPDATE public.workspaces SET is_default=false WHERE is_default IS NULL;
        UPDATE public.workspaces SET created_at=now() WHERE created_at IS NULL;
        UPDATE public.workspaces SET updated_at=now() WHERE updated_at IS NULL;
    END IF;
    IF to_regclass('public.workspace_members') IS NOT NULL THEN
        ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS workspace_id uuid;
        ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS membership_id uuid;
        ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
        UPDATE public.workspace_members SET created_at=now() WHERE created_at IS NULL;
    END IF;
    IF to_regclass('public.tenant_onboarding') IS NOT NULL THEN
        ALTER TABLE public.tenant_onboarding ADD COLUMN IF NOT EXISTS tenant_id uuid;
        ALTER TABLE public.tenant_onboarding ADD COLUMN IF NOT EXISTS step_data jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE public.tenant_onboarding ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false;
        ALTER TABLE public.tenant_onboarding ADD COLUMN IF NOT EXISTS current_step smallint DEFAULT 0;
        ALTER TABLE public.tenant_onboarding ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
        UPDATE public.tenant_onboarding SET step_data='{}'::jsonb WHERE step_data IS NULL;
        UPDATE public.tenant_onboarding SET completed=false WHERE completed IS NULL;
        UPDATE public.tenant_onboarding SET current_step=0 WHERE current_step IS NULL;
        UPDATE public.tenant_onboarding SET updated_at=now() WHERE updated_at IS NULL;
    END IF;
END $$;

-- ============================================================
-- ARKA WORKSPACE + ONBOARDING EXTENSIONS
-- Reference-aligned application model
-- ============================================================

create table if not exists public.workspaces (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    slug text not null,
    status text not null default 'active' check (status in ('active','suspended','archived')),
    is_default boolean not null default false,
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(tenant_id, slug)
);

create unique index if not exists workspaces_default_unique
on public.workspaces(tenant_id)
where is_default = true;

create table if not exists public.workspace_members (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    membership_id uuid not null references public.user_tenant_memberships(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique(workspace_id, membership_id)
);

create table if not exists public.tenant_onboarding (
    tenant_id uuid primary key references public.tenants(id) on delete cascade,
    step_data jsonb not null default '{}'::jsonb,
    completed boolean not null default false,
    current_step smallint not null default 0 check (current_step between 0 and 4),
    updated_at timestamptz not null default now()
);

create index if not exists workspaces_tenant_idx on public.workspaces(tenant_id);
create index if not exists workspace_members_workspace_idx on public.workspace_members(workspace_id);
create index if not exists workspace_members_membership_idx on public.workspace_members(membership_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.tenant_onboarding enable row level security;

drop policy if exists "members read workspaces" on public.workspaces;

create policy "members read workspaces"
on public.workspaces
for select to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "tenant admins manage workspaces" on public.workspaces;

create policy "tenant admins manage workspaces"
on public.workspaces
for all to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

drop policy if exists "members read workspace memberships" on public.workspace_members;

create policy "members read workspace memberships"
on public.workspace_members
for select to authenticated
using (
    exists (
        select 1
        from public.workspaces w
        where w.id = workspace_members.workspace_id
          and public.is_tenant_member(w.tenant_id)
    )
);

drop policy if exists "tenant admins manage workspace memberships" on public.workspace_members;

create policy "tenant admins manage workspace memberships"
on public.workspace_members
for all to authenticated
using (
    exists (
        select 1
        from public.workspaces w
        where w.id = workspace_members.workspace_id
          and public.is_tenant_admin(w.tenant_id)
    )
)
with check (
    exists (
        select 1
        from public.workspaces w
        where w.id = workspace_members.workspace_id
          and public.is_tenant_admin(w.tenant_id)
    )
);

drop policy if exists "members read onboarding" on public.tenant_onboarding;

create policy "members read onboarding"
on public.tenant_onboarding
for select to authenticated
using (public.is_tenant_member(tenant_id) or public.is_super_admin());

create or replace function public.save_tenant_onboarding(
    p_organization_name text,
    p_business_vertical text,
    p_organization_size text,
    p_cloud_presence jsonb,
    p_security_technologies jsonb,
    p_security_stack jsonb,
    p_security_priorities jsonb,
    p_step smallint,
    p_step_data jsonb,
    p_completed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_profile public.profiles%rowtype;
    v_tenant_id uuid;
    v_admin_role uuid;
    v_user_role uuid;
    v_membership_id uuid;
    v_workspace_id uuid;
    v_slug text;
    v_workspace_slug text;
    v_payload jsonb;
begin
    if v_user is null then raise exception 'Authentication required'; end if;

    -- Onboarding is a tenant-admin bootstrap operation only. Platform admins
    -- and ordinary tenant users must never be able to invoke it. A user with
    -- no active tenant membership is the one allowed pending-signup case;
    -- the RPC will create that user's tenant + TENANT_ADMIN membership.
    if public.is_super_admin() then
        raise exception 'Platform admins cannot complete tenant onboarding';
    end if;
    if exists (
        select 1
        from public.user_tenant_memberships m
        join public.roles r on r.id = m.role_id
        where m.user_id = v_user
          and m.status = 'active'
          and r.code = 'TENANT_USER'
    ) then
        raise exception 'Tenant users cannot complete organization onboarding';
    end if;

    select * into v_profile from public.profiles where id = v_user;
    if v_profile.id is null then raise exception 'Profile not found'; end if;

    if p_organization_name is null or btrim(p_organization_name) = '' then
        raise exception 'Organization name is required';
    end if;
    if p_business_vertical is null or btrim(p_business_vertical) = '' then
        raise exception 'Business vertical is required';
    end if;

    v_payload := coalesce(p_step_data, '{}'::jsonb)
        || jsonb_build_object(
            'organizationName', btrim(p_organization_name),
            'businessVertical', btrim(p_business_vertical),
            'organizationSize', coalesce(p_organization_size, ''),
            'cloudPresence', coalesce(p_cloud_presence, '[]'::jsonb),
            'securityTechnologies', coalesce(p_security_technologies, '[]'::jsonb),
            'securityStack', coalesce(p_security_stack, '{}'::jsonb),
            'securityPriorities', coalesce(p_security_priorities, '[]'::jsonb)
        );

    select m.tenant_id, m.role_id, m.id
      into v_tenant_id, v_admin_role, v_membership_id
      from public.user_tenant_memberships m
      join public.roles r on r.id = m.role_id
     where m.user_id = v_user
       and m.status = 'active'
       and r.code = 'TENANT_ADMIN'
       and r.scope = 'tenant'
     limit 1;

    if v_tenant_id is null then
        v_slug := lower(regexp_replace(btrim(p_organization_name), '[^a-zA-Z0-9]+', '-', 'g'));
        v_slug := trim(both '-' from v_slug);
        if v_slug = '' then v_slug := 'organization'; end if;
        if exists (select 1 from public.tenants where slug = v_slug) then
            v_slug := left(v_slug, 42) || '-' || substr(v_user::text, 1, 8);
        end if;

        insert into public.tenants(name, slug, status, settings, created_by)
        values (btrim(p_organization_name), v_slug,
                case when p_completed then 'active'::public.tenant_status else 'onboarding'::public.tenant_status end,
                jsonb_build_object('organization_size', coalesce(p_organization_size, '')),
                v_user)
        returning id into v_tenant_id;

        insert into public.roles(code, name, description, scope, tenant_id, is_system_role)
        values
          ('TENANT_ADMIN', 'Tenant Admin', 'Tenant-scoped administrator', 'tenant', v_tenant_id, true),
          ('TENANT_USER', 'Tenant User', 'Tenant operational user', 'tenant', v_tenant_id, true)
        returning id into v_admin_role;

        select id into v_admin_role from public.roles
         where tenant_id = v_tenant_id and code = 'TENANT_ADMIN' and scope = 'tenant';
        select id into v_user_role from public.roles
         where tenant_id = v_tenant_id and code = 'TENANT_USER' and scope = 'tenant';

        -- Core tenant permissions copied from the reference model.
        insert into public.role_permissions(role_id, permission_id)
        select v_admin_role, p.id from public.permissions p
        where (p.resource, p.action) in (
            ('tenant','read'),('tenant','update'),('tenant','manage'),
            ('users','read'),('users','invite'),('users','update'),('users','disable'),('users','delete'),
            ('roles','read'),('roles','manage'),
            ('integrations','read'),('integrations','manage'),
            ('alerts','read'),('alerts','create'),('alerts','update'),('alerts','manage'),
            ('investigations','read'),('investigations','create'),('investigations','update'),
            ('dashboards','read'),('dashboards','create'),('dashboards','update'),('dashboards','delete'),
            ('workflows','read'),('workflows','create'),('workflows','update'),('workflows','execute'),
            ('audit','read')
        ) on conflict do nothing;

        insert into public.role_permissions(role_id, permission_id)
        select v_user_role, p.id from public.permissions p
        where (p.resource, p.action) in (
            ('alerts','read'),
            ('investigations','read'),('investigations','create'),
            ('dashboards','read'),
            ('workflows','execute')
        ) on conflict do nothing;

        insert into public.user_tenant_memberships(user_id, tenant_id, role_id, status, joined_at)
        values(v_user, v_tenant_id, v_admin_role, 'active', now())
        returning id into v_membership_id;
    else
        update public.tenants
           set name = btrim(p_organization_name),
               settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('organization_size', coalesce(p_organization_size, '')),
               status = case when p_completed then 'active'::public.tenant_status else 'onboarding'::public.tenant_status end,
               updated_at = now()
         where id = v_tenant_id;
    end if;

    update public.tenants
       set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('onboarding', v_payload),
           status = case when p_completed then 'active'::public.tenant_status else 'onboarding'::public.tenant_status end,
           updated_at = now()
     where id = v_tenant_id;

    -- Keep normalized tenant configuration in tenant_settings while the full
    -- onboarding snapshot remains in tenant_onboarding.step_data.
    insert into public.tenant_settings(
        tenant_id,
        security_settings,
        ai_settings,
        notification_settings,
        updated_at
    )
    values (
        v_tenant_id,
        jsonb_build_object(
            'cloud_presence', coalesce(p_cloud_presence, '[]'::jsonb),
            'security_technologies', coalesce(p_security_technologies, '[]'::jsonb),
            'security_stack', coalesce(p_security_stack, '{}'::jsonb),
            'security_priorities', coalesce(p_security_priorities, '[]'::jsonb)
        ),
        '{}'::jsonb,
        '{}'::jsonb,
        now()
    )
    on conflict (tenant_id) do update set
        security_settings = excluded.security_settings,
        updated_at = now();

    insert into public.tenant_onboarding(tenant_id, step_data, completed, current_step, updated_at)
    values(v_tenant_id, v_payload, p_completed, p_step, now())
    on conflict(tenant_id) do update set
       step_data = excluded.step_data,
       completed = excluded.completed,
       current_step = excluded.current_step,
       updated_at = now();

    if p_completed then
        v_workspace_slug := lower(regexp_replace(btrim(p_organization_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-security';
        v_workspace_slug := trim(both '-' from v_workspace_slug);
        if length(v_workspace_slug) > 72 then v_workspace_slug := left(v_workspace_slug, 72); end if;

        insert into public.workspaces(tenant_id, name, slug, status, is_default, settings)
        values(
            v_tenant_id,
            btrim(p_organization_name) || ' Security',
            v_workspace_slug,
            'active', true,
            jsonb_build_object(
                'cloud_presence', coalesce(p_cloud_presence, '[]'::jsonb),
                'security_technologies', coalesce(p_security_technologies, '[]'::jsonb),
                'security_stack', coalesce(p_security_stack, '{}'::jsonb),
                'security_priorities', coalesce(p_security_priorities, '[]'::jsonb)
            )
        )
        on conflict(tenant_id, slug) do update set
            name = excluded.name,
            status = excluded.status,
            settings = excluded.settings,
            updated_at = now()
        returning id into v_workspace_id;

        if v_workspace_id is null then
            select id into v_workspace_id from public.workspaces where tenant_id = v_tenant_id and is_default = true limit 1;
        end if;

        insert into public.workspace_members(workspace_id, membership_id)
        values(v_workspace_id, v_membership_id)
        on conflict do nothing;
    end if;

    insert into public.audit_logs(actor_id, tenant_id, action, resource_type, resource_id, metadata)
    values (
      v_user, v_tenant_id,
      case when p_completed then 'tenant_onboarding_completed' else 'tenant_onboarding_saved' end,
      'workspace', v_workspace_id,
      jsonb_build_object('step', p_step, 'workspace_created', p_completed)
    );

    update public.profiles set status = 'active', updated_at = now() where id = v_user;

    return jsonb_build_object(
        'tenant_id', v_tenant_id,
        'membership_id', v_membership_id,
        'workspace_id', v_workspace_id,
        'step', p_step,
        'completed', p_completed
    );
end;
$$;

revoke all on function public.save_tenant_onboarding(text,text,text,jsonb,jsonb,jsonb,jsonb,smallint,jsonb,boolean) from public;
grant execute on function public.save_tenant_onboarding(text,text,text,jsonb,jsonb,jsonb,jsonb,smallint,jsonb,boolean) to authenticated;


-- ============================================================
-- 40. FINAL COMPATIBILITY ASSERTIONS
-- ============================================================
-- Fail early with a useful message if a partially-existing table could not
-- be reconciled. This is deliberately after all CREATE/ALTER operations.
DO $$
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        RAISE EXCEPTION 'ARKA setup failed: public.profiles is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='profiles' AND column_name='is_platform_user'
    ) THEN
        RAISE EXCEPTION 'ARKA setup failed: profiles.is_platform_user is missing';
    END IF;
    IF to_regclass('public.user_tenant_memberships') IS NULL THEN
        RAISE EXCEPTION 'ARKA setup failed: public.user_tenant_memberships is missing';
    END IF;
END $$;

commit;
