-- ARKA auth routing fix
-- Apply after the existing identity/RBAC schema.

begin;

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

-- Allow authenticated users to resolve their role label through normal
-- relationship reads as a fallback. Authorization decisions still use the
-- SECURITY DEFINER helper functions.
drop policy if exists "authenticated can read roles needed for routing" on public.roles;
create policy "authenticated can read roles needed for routing"
on public.roles
for select
to authenticated
using (
    public.is_super_admin()
    or tenant_id is null
    or exists (
        select 1
        from public.user_tenant_memberships m
        where m.user_id = auth.uid()
          and m.tenant_id = public.roles.tenant_id
          and m.status = 'active'
    )
);

commit;
