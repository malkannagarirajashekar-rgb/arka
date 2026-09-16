-- ============================================================
-- ARKA V33 — Production RBAC hardening
--
-- This migration is additive and designed to run AFTER the V31/V32
-- compatibility migration. It removes email/metadata-based authorization,
-- makes the database the sole authority for roles, and prevents ordinary
-- authenticated users from modifying protected authorization fields.
--
-- Existing data is preserved. No email is hard-coded here.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Database is the only role authority
-- ------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_platform_user, false) = true
      and coalesce(lower(p.status::text), 'active') = 'active'
  )
  or exists (
    select 1
    from public.user_tenant_memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and r.scope = 'platform'
      and upper(r.code) = 'SUPER_ADMIN'
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- ------------------------------------------------------------
-- 2. Authoritative access context
-- ------------------------------------------------------------
-- The frontend calls this function. It uses auth.uid() only; it never
-- examines Google/email provider metadata for authorization.

create or replace function public.get_my_access_context()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then
    return null;
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_user) then
    return null;
  end if;

  -- Platform access always wins over any legacy tenant role/membership.
  if public.is_super_admin() then
    select jsonb_build_object(
      'user_id', p.id,
      'email', coalesce(p.email, u.email, ''),
      'full_name', coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
      'tenant_id', null,
      'role', 'SUPER_ADMIN',
      'role_name', 'Super Admin',
      'access_state', 'ACTIVE',
      'onboarding_required', false
    )
    into v_result
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = v_user;
    return v_result;
  end if;

  -- An active tenant membership is the only authority for tenant roles.
  select jsonb_build_object(
    'user_id', p.id,
    'email', coalesce(p.email, u.email, ''),
    'full_name', coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
    'tenant_id', m.tenant_id,
    'role', upper(r.code),
    'role_name', r.name,
    'access_state', 'ACTIVE',
    'onboarding_required',
      case
        when upper(r.code) = 'TENANT_ADMIN' then not coalesce(o.completed, false)
        else false
      end
  )
  into v_result
  from public.profiles p
  join auth.users u on u.id = p.id
  join lateral (
    select m.*
    from public.user_tenant_memberships m
    join public.roles rr on rr.id = m.role_id
    where m.user_id = v_user
      and m.status = 'active'
      and rr.scope = 'tenant'
    order by
      case when upper(rr.code) = 'TENANT_ADMIN' then 0 else 1 end,
      m.created_at asc
    limit 1
  ) m on true
  join public.roles r on r.id = m.role_id
  left join public.tenant_onboarding o on o.tenant_id = m.tenant_id
  where p.id = v_user;

  if v_result is not null then
    return v_result;
  end if;

  -- Fresh authenticated users are pending tenant bootstrap. This is an
  -- onboarding STATE, not a stored role and not a provider-derived role.
  if exists (
    select 1 from public.profiles p
    where p.id = v_user
      and lower(p.status::text) = 'pending'
  ) then
    select jsonb_build_object(
      'user_id', p.id,
      'email', coalesce(p.email, u.email, ''),
      'full_name', coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
      'tenant_id', null,
      'role', null,
      'role_name', null,
      'access_state', 'PENDING_TENANT_ONBOARDING',
      'onboarding_required', true
    )
    into v_result
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = v_user;
    return v_result;
  end if;

  return null;
end;
$$;

revoke all on function public.get_my_access_context() from public;
grant execute on function public.get_my_access_context() to authenticated;

-- ------------------------------------------------------------
-- 3. Membership integrity
-- ------------------------------------------------------------
-- A tenant administrator may manage users only inside their tenant. This
-- database constraint also prevents assigning a role belonging to a different
-- tenant, even if a client sends a crafted role_id.

create or replace function public.guard_membership_role_scope()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_scope public.role_scope;
  v_role_tenant uuid;
begin
  select scope, tenant_id into v_scope, v_role_tenant
  from public.roles
  where id = new.role_id;

  if v_scope is null then
    raise exception 'Invalid role';
  end if;

  if v_scope <> 'tenant' or v_role_tenant is distinct from new.tenant_id then
    raise exception 'Membership role must belong to the same tenant';
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_role_scope_guard on public.user_tenant_memberships;
create trigger memberships_role_scope_guard
before insert or update of tenant_id, role_id on public.user_tenant_memberships
for each row execute function public.guard_membership_role_scope();

-- ------------------------------------------------------------
-- 4. Protected profile fields
-- ------------------------------------------------------------
-- A normal user may edit profile presentation fields, but cannot promote
-- themselves, move tenants, or change account status/legacy role.

create or replace function public.guard_profile_authorization_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and not public.is_super_admin() then
    new.is_platform_user := old.is_platform_user;
    new.role := old.role;
    new.tenant_id := old.tenant_id;
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_authorization_guard on public.profiles;
create trigger profiles_authorization_guard
before update on public.profiles
for each row execute function public.guard_profile_authorization_fields();

-- Tighten the existing profile policy: users can update their own profile,
-- while the trigger above protects authorization fields. Platform admins can
-- administer profiles through normal authenticated access.
drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

-- ------------------------------------------------------------
-- 5. Secure platform-admin promotion
-- ------------------------------------------------------------
-- UUID, not email, is the target identity. Only an existing Super Admin may
-- promote another user from the application. The service role can bootstrap
-- the very first platform admin when necessary.

drop function if exists public.provision_platform_admin(text);

create or replace function public.provision_platform_admin(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'No Supabase Auth user exists for %', p_user_id;
  end if;

  -- This function is service-role bootstrap only. The normal application path
  -- is promote_platform_admin(), which requires an existing Super Admin.
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Bootstrap platform-admin provisioning requires the service role';
  end if;

  update public.profiles p
  set is_platform_user = true,
      status = 'active',
      updated_at = now()
  where p.id = p_user_id;

  if not found then
    raise exception 'Profile does not exist for Auth user %', p_user_id;
  end if;

  return p_user_id;
end;
$$;

revoke all on function public.provision_platform_admin(uuid) from public;
grant execute on function public.provision_platform_admin(uuid) to service_role;

create or replace function public.promote_platform_admin(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_super_admin() then
    raise exception 'Only an existing Super Admin can promote a platform administrator';
  end if;
  if p_user_id is null then
    raise exception 'User id is required';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'No Supabase Auth user exists for %', p_user_id;
  end if;

  update public.profiles
  set is_platform_user = true,
      status = 'active',
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Profile does not exist for Auth user %', p_user_id;
  end if;

  insert into public.audit_logs(actor_id, tenant_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), null, 'platform_admin_promoted', 'profile', p_user_id::text, '{}'::jsonb);

  return p_user_id;
end;
$$;

revoke all on function public.promote_platform_admin(uuid) from public;
grant execute on function public.promote_platform_admin(uuid) to authenticated;

-- Optional demotion path, also controlled by an existing Super Admin. It does
-- not delete the user or their tenant data.
create or replace function public.demote_platform_admin(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_super_admin() then raise exception 'Only an existing Super Admin can demote a platform administrator'; end if;
  if p_user_id = auth.uid() then raise exception 'A Super Admin cannot demote themselves'; end if;

  update public.profiles
  set is_platform_user = false,
      updated_at = now()
  where id = p_user_id;

  if not found then raise exception 'Profile does not exist for Auth user %', p_user_id; end if;

  insert into public.audit_logs(actor_id, tenant_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), null, 'platform_admin_demoted', 'profile', p_user_id::text, '{}'::jsonb);

  return p_user_id;
end;
$$;

revoke all on function public.demote_platform_admin(uuid) from public;
grant execute on function public.demote_platform_admin(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Remove provider metadata as an authorization mechanism
-- ------------------------------------------------------------
-- New users are always created as pending, non-platform profiles by the
-- existing handle_new_user trigger. Explicitly ensure those fields cannot be
-- populated from OAuth metadata by replacing the trigger function.

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
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='role'
  ) into has_role;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='role' and is_nullable='NO'
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
      raise exception 'profiles.role is required, but no compatible app_role value exists';
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
-- 7. Verification helpers
-- ------------------------------------------------------------

create or replace view public.arka_security_identity_check as
select
  p.id,
  p.email,
  p.is_platform_user,
  p.status,
  p.tenant_id,
  p.role::text as legacy_role,
  case
    when p.is_platform_user = true and lower(p.status::text) = 'active' then 'SUPER_ADMIN'
    when exists (
      select 1
      from public.user_tenant_memberships m
      join public.roles r on r.id=m.role_id
      where m.user_id=p.id and m.status='active' and r.scope='tenant' and upper(r.code)='TENANT_ADMIN'
    ) then 'TENANT_ADMIN'
    when exists (
      select 1
      from public.user_tenant_memberships m
      join public.roles r on r.id=m.role_id
      where m.user_id=p.id and m.status='active' and r.scope='tenant' and upper(r.code)='TENANT_USER'
    ) then 'TENANT_USER'
    when lower(p.status::text)='pending' then 'PENDING_TENANT_ONBOARDING'
    else 'UNASSIGNED'
  end as authoritative_access
from public.profiles p;

commit;
