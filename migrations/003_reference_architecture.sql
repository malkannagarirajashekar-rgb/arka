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
          and p.is_platform_user = true
    );

$$;


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

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
    or public.is_super_admin()
);


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

create policy "members can read tenant"
on public.tenants
for select
to authenticated
using (
    public.is_tenant_member(id)
);


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

create policy "users can view own memberships"
on public.user_tenant_memberships
for select
to authenticated
using (
    user_id = auth.uid()
    or public.is_tenant_admin(tenant_id)
);


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

create policy "members read tenant settings"
on public.tenant_settings
for select
to authenticated
using (
    public.is_tenant_member(tenant_id)
);


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

create policy "tenant members read tenant audit"
on public.audit_logs
for select
to authenticated
using (
    public.is_tenant_member(tenant_id)
);


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

create policy "authenticated users can read permissions"
on public.permissions
for select
to authenticated
using (true);


create policy "authenticated users can read roles"
on public.roles
for select
to authenticated
using (
    scope = 'platform'
    or tenant_id is null
    or public.is_tenant_member(tenant_id)
);


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


commit;


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

create policy "members read workspaces"
on public.workspaces
for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant admins manage workspaces"
on public.workspaces
for all to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

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

commit;