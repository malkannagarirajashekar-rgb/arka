-- ARKA FINAL VERIFICATION — run after 20260916_0001_arka_final.sql

select 'profiles' as object, to_regclass('public.profiles') is not null as exists;
select 'tenants' as object, to_regclass('public.tenants') is not null as exists;
select 'roles' as object, to_regclass('public.roles') is not null as exists;
select 'user_tenant_memberships' as object, to_regclass('public.user_tenant_memberships') is not null as exists;
select 'tenant_onboarding' as object, to_regclass('public.tenant_onboarding') is not null as exists;

select column_name, data_type, udt_name
from information_schema.columns
where table_schema='public' and table_name='profiles'
order by ordinal_position;

select id,email,full_name,role,tenant_id,is_platform_user,status
from public.profiles
order by created_at nulls first;

select r.code,r.name,r.scope,r.tenant_id,count(m.id) as memberships
from public.roles r
left join public.user_tenant_memberships m on m.role_id=r.id
 group by r.id,r.code,r.name,r.scope,r.tenant_id
 order by r.scope,r.code,r.tenant_id;

select p.email,m.tenant_id,t.name,r.code,r.name as role_name,m.status
from public.user_tenant_memberships m
join public.profiles p on p.id=m.user_id
join public.tenants t on t.id=m.tenant_id
join public.roles r on r.id=m.role_id
order by p.email,t.name;

-- Current signed-in user's secure access context (returns null in SQL editor unless auth.uid is available).
select public.get_my_access_context();


-- V33 production RBAC checks
select proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in ('provision_platform_admin','promote_platform_admin','demote_platform_admin','get_my_access_context')
order by proname;

select id,email,is_platform_user,status,tenant_id,role::text as legacy_role,
       case when is_platform_user and lower(status::text)='active' then 'SUPER_ADMIN'
            when lower(status::text)='pending' then 'PENDING_TENANT_ONBOARDING'
            else 'TENANT_MEMBERSHIP' end as db_identity_state
from public.profiles
order by created_at nulls first;
