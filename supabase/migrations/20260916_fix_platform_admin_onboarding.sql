-- ARKA: platform-admin onboarding isolation
-- Run this migration in Supabase before using the Tenant Admin bootstrap flow.

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

    -- Profile flag is an explicit platform-admin marker.
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

    -- Platform membership always wins over any tenant membership.
    if exists (
        select 1
        from public.user_tenant_memberships m
        join public.roles r on r.id = m.role_id
        where m.user_id = v_user
          and m.status = 'active'
          and upper(r.code) = 'SUPER_ADMIN'
          and lower(r.scope) = 'platform'
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
        'role', upper(r.code),
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

-- Database-level protection: platform admins cannot bootstrap tenants through
-- the onboarding RPC, even if the browser is manipulated.
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
        join public.roles r on r.id = m.role_id
        where m.user_id = auth.uid()
          and m.status = 'active'
          and upper(r.code) = 'SUPER_ADMIN'
          and lower(r.scope) = 'platform'
    )
    or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_platform_user = true
    );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;
