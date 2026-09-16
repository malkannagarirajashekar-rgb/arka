-- ARKA V48 — platform user invitations + authoritative role management
-- Additive migration. Does not delete users, tenants, memberships or audit history.

begin;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role_code text,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text := upper(trim(coalesce(p_role_code,'')));
  v_role_id uuid;
  v_tenant_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_super_admin() then raise exception 'Only a Super Admin can manage platform roles'; end if;
  if p_user_id is null then raise exception 'User id is required'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Profile does not exist'; end if;
  if v_role not in ('SUPER_ADMIN','TENANT_ADMIN','TENANT_USER') then raise exception 'Unsupported role: %', v_role; end if;
  if p_user_id=auth.uid() then raise exception 'A Super Admin cannot change their own role'; end if;

  if v_role='SUPER_ADMIN' then
    update public.profiles
       set is_platform_user=true,
           status='active',
           updated_at=now()
     where id=p_user_id;

    insert into public.audit_logs(actor_id,tenant_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),null,'platform_role_assigned','profile',p_user_id::text,jsonb_build_object('role',v_role));

    return jsonb_build_object('user_id',p_user_id,'role',v_role,'tenant_id',null);
  end if;

  if p_tenant_id is null then raise exception 'Tenant is required for %',v_role; end if;
  if not exists(select 1 from public.tenants where id=p_tenant_id) then raise exception 'Tenant does not exist'; end if;

  select id into v_role_id
  from public.roles
  where tenant_id=p_tenant_id
    and scope='tenant'::public.role_scope
    and upper(code)=v_role
  limit 1;

  if v_role_id is null then
    insert into public.roles(code,name,description,scope,tenant_id,is_system_role)
    values(v_role, case when v_role='TENANT_ADMIN' then 'Tenant Admin' else 'Tenant User' end,
      case when v_role='TENANT_ADMIN' then 'Full administration of one organization' else 'Standard organization access' end,
      'tenant'::public.role_scope,p_tenant_id,true)
    returning id into v_role_id;
  end if;

  -- A platform administrator assignment is mutually exclusive with a tenant role.
  update public.profiles
     set is_platform_user=false,
         tenant_id=p_tenant_id,
         status='active',
         updated_at=now()
   where id=p_user_id;

  -- Keep one authoritative active organization assignment for the platform console.
  update public.user_tenant_memberships
     set status='removed'::public.membership_status,
         updated_at=now()
   where user_id=p_user_id
     and status='active'::public.membership_status
     and tenant_id<>p_tenant_id;

  insert into public.user_tenant_memberships(user_id,tenant_id,role_id,status,invited_by,joined_at)
  values(p_user_id,p_tenant_id,v_role_id,'active'::public.membership_status,auth.uid(),coalesce((select joined_at from public.user_tenant_memberships where user_id=p_user_id and tenant_id=p_tenant_id),now()))
  on conflict(user_id,tenant_id) do update set
    role_id=excluded.role_id,
    status='active'::public.membership_status,
    invited_by=auth.uid(),
    joined_at=coalesce(public.user_tenant_memberships.joined_at,now()),
    updated_at=now();

  select name into v_tenant_name from public.tenants where id=p_tenant_id;

  insert into public.audit_logs(actor_id,tenant_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),p_tenant_id,'tenant_role_assigned','profile',p_user_id::text,jsonb_build_object('role',v_role,'tenant_name',v_tenant_name));

  return jsonb_build_object('user_id',p_user_id,'role',v_role,'tenant_id',p_tenant_id,'tenant_name',v_tenant_name);
end;
$$;

revoke all on function public.admin_set_user_role(uuid,text,uuid) from public;
grant execute on function public.admin_set_user_role(uuid,text,uuid) to authenticated;

commit;
