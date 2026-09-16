-- ARKA V37 — onboarding save repair
-- Replaces the fragile onboarding write path with a uniquely named RPC.
-- This avoids ambiguity with legacy save_tenant_onboarding functions and
-- deliberately uses LIMIT 1 for every lookup that feeds a scalar variable.

begin;

create or replace function public.save_arka_tenant_onboarding(
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tenant_id uuid;
  v_admin_role uuid;
  v_user_role uuid;
  v_membership_id uuid;
  v_workspace_id uuid;
  v_slug text;
  v_workspace_slug text;
  v_payload jsonb;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if public.is_super_admin() then
    raise exception 'Platform admins cannot complete tenant onboarding';
  end if;

  if p_organization_name is null or btrim(p_organization_name) = '' then
    raise exception 'Organization name is required';
  end if;

  if p_business_vertical is null or btrim(p_business_vertical) = '' then
    raise exception 'Business vertical is required';
  end if;

  if exists (
    select 1
    from public.user_tenant_memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = v_user
      and m.status = 'active'
      and upper(r.code) = 'TENANT_USER'
    limit 1
  ) then
    raise exception 'Tenant users cannot complete organization onboarding';
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

  -- Resume an existing Tenant Admin membership, deterministically.
  select m.tenant_id, m.role_id, m.id
    into v_tenant_id, v_admin_role, v_membership_id
    from public.user_tenant_memberships m
    join public.roles r on r.id = m.role_id
   where m.user_id = v_user
     and m.status = 'active'
     and upper(r.code) = 'TENANT_ADMIN'
     and r.scope = 'tenant'
   order by m.created_at asc
   limit 1;

  -- Fresh signup: create exactly one tenant and its tenant-scoped roles.
  if v_tenant_id is null then
    v_slug := lower(regexp_replace(btrim(p_organization_name), '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' then v_slug := 'organization'; end if;
    if length(v_slug) > 54 then v_slug := left(v_slug, 54); end if;

    if exists (select 1 from public.tenants where slug = v_slug limit 1) then
      v_slug := left(v_slug, 45) || '-' || substr(replace(v_user::text, '-', ''), 1, 8);
    end if;

    insert into public.tenants(name, slug, status, settings, created_by)
    values (
      btrim(p_organization_name),
      v_slug,
      case when p_completed then 'active' else 'onboarding' end,
      jsonb_build_object('organization_size', coalesce(p_organization_size, '')),
      v_user
    )
    returning id into v_tenant_id;

    insert into public.roles(code, name, description, scope, tenant_id, is_system_role)
    values ('TENANT_ADMIN', 'Tenant Admin', 'Full administration of one organization', 'tenant', v_tenant_id, true);

    insert into public.roles(code, name, description, scope, tenant_id, is_system_role)
    values ('TENANT_USER', 'Tenant User', 'Standard organization access', 'tenant', v_tenant_id, true);

    select id into v_admin_role
    from public.roles
    where tenant_id = v_tenant_id
      and upper(code) = 'TENANT_ADMIN'
      and scope = 'tenant'
    order by created_at asc
    limit 1;

    select id into v_user_role
    from public.roles
    where tenant_id = v_tenant_id
      and upper(code) = 'TENANT_USER'
      and scope = 'tenant'
    order by created_at asc
    limit 1;

    insert into public.user_tenant_memberships(user_id, tenant_id, role_id, status, joined_at)
    values (v_user, v_tenant_id, v_admin_role, 'active', now())
    on conflict (user_id, tenant_id) do update
      set role_id = excluded.role_id,
          status = 'active',
          joined_at = coalesce(public.user_tenant_memberships.joined_at, excluded.joined_at),
          updated_at = now()
    returning id into v_membership_id;
  end if;

  -- Keep the legacy profile tenant pointer synchronized, without making it
  -- the authorization source.
  update public.profiles
     set tenant_id = v_tenant_id,
         updated_at = now()
   where id = v_user;

  insert into public.tenant_settings(tenant_id)
  values (v_tenant_id)
  on conflict (tenant_id) do nothing;

  -- The current ARKA table has tenant_id as its primary/unique key.
  insert into public.tenant_onboarding(
    tenant_id,
    organization_name,
    business_vertical,
    organization_size,
    cloud_presence,
    security_technologies,
    security_stack,
    security_priorities,
    current_step,
    completed,
    step_data
  )
  values (
    v_tenant_id,
    btrim(p_organization_name),
    btrim(p_business_vertical),
    p_organization_size,
    coalesce(p_cloud_presence, '[]'::jsonb),
    coalesce(p_security_technologies, '[]'::jsonb),
    coalesce(p_security_stack, '{}'::jsonb),
    coalesce(p_security_priorities, '[]'::jsonb),
    greatest(1, least(4, coalesce(p_step, 1))),
    p_completed,
    v_payload
  )
  on conflict (tenant_id) do update set
    organization_name = excluded.organization_name,
    business_vertical = excluded.business_vertical,
    organization_size = excluded.organization_size,
    cloud_presence = excluded.cloud_presence,
    security_technologies = excluded.security_technologies,
    security_stack = excluded.security_stack,
    security_priorities = excluded.security_priorities,
    current_step = excluded.current_step,
    completed = excluded.completed,
    step_data = excluded.step_data,
    updated_at = now();

  update public.tenants
     set name = btrim(p_organization_name),
         status = case when p_completed then 'active' else 'onboarding' end,
         settings = coalesce(settings, '{}'::jsonb)
           || jsonb_build_object('organization_size', coalesce(p_organization_size, ''), 'onboarding', v_payload),
         updated_at = now()
   where id = v_tenant_id;

  -- A workspace is only needed once onboarding is complete.
  if p_completed then
    v_workspace_slug := lower(regexp_replace(btrim(p_organization_name), '[^a-zA-Z0-9]+', '-', 'g'));
    v_workspace_slug := trim(both '-' from v_workspace_slug);
    if v_workspace_slug = '' then v_workspace_slug := 'organization'; end if;
    v_workspace_slug := left(v_workspace_slug, 62) || '-security';

    if exists (
      select 1 from public.workspaces
      where tenant_id = v_tenant_id and slug = v_workspace_slug
      limit 1
    ) then
      select id into v_workspace_id
      from public.workspaces
      where tenant_id = v_tenant_id and slug = v_workspace_slug
      order by created_at asc
      limit 1;
    else
      insert into public.workspaces(tenant_id, name, slug, status, is_default, settings)
      values (
        v_tenant_id,
        btrim(p_organization_name) || ' Security',
        v_workspace_slug,
        'active',
        true,
        jsonb_build_object(
          'cloud_presence', coalesce(p_cloud_presence, '[]'::jsonb),
          'security_technologies', coalesce(p_security_technologies, '[]'::jsonb),
          'security_stack', coalesce(p_security_stack, '{}'::jsonb),
          'security_priorities', coalesce(p_security_priorities, '[]'::jsonb)
        )
      )
      returning id into v_workspace_id;
    end if;

    if v_workspace_id is not null and v_membership_id is not null then
      insert into public.workspace_members(workspace_id, membership_id)
      values (v_workspace_id, v_membership_id)
      on conflict do nothing;
    end if;
  end if;

  -- Current ARKA audit schema uses entity_type/entity_id. Keep this write
  -- intentionally simple so an audit row can never block onboarding.
  begin
    insert into public.audit_logs(actor_id, tenant_id, action, entity_type, entity_id, metadata)
    values (
      v_user,
      v_tenant_id,
      case when p_completed then 'tenant_onboarding_completed' else 'tenant_onboarding_saved' end,
      'tenant',
      v_tenant_id::text,
      jsonb_build_object('step', p_step, 'completed', p_completed)
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'tenant_id', v_tenant_id,
    'membership_id', v_membership_id,
    'workspace_id', v_workspace_id,
    'step', greatest(1, least(4, coalesce(p_step, 1))),
    'completed', p_completed
  );
end;
$$;

revoke all on function public.save_arka_tenant_onboarding(text,text,text,jsonb,jsonb,jsonb,jsonb,smallint,jsonb,boolean) from public;
grant execute on function public.save_arka_tenant_onboarding(text,text,text,jsonb,jsonb,jsonb,jsonb,smallint,jsonb,boolean) to authenticated;

commit;
