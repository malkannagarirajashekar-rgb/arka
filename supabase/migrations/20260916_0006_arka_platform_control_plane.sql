-- ARKA V54 — platform control-plane registries
-- Non-destructive: creates only new platform registry/config tables.
-- Run after the existing ARKA RBAC migrations (0001–0005).
-- These tables are intentionally separate from tenant-scoped apps/integrations/agents.

create table if not exists public.platform_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  version text not null default '1.0',
  status text not null default 'draft',
  tenant_count integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  version text not null default '1.0',
  status text not null default 'draft',
  tenant_count integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  capabilities text[] not null default '{}',
  tools text[] not null default '{}',
  models text[] not null default '{}',
  permissions text[] not null default '{}',
  policies text[] not null default '{}',
  version text not null default '1.0',
  status text not null default 'draft',
  deployment_status text not null default 'undeployed',
  tenant_availability text not null default 'none',
  tenant_count integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_config (
  id boolean primary key default true check (id = true),
  maintenance_mode boolean not null default false,
  allow_new_signups boolean not null default true,
  default_region text not null default 'default',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_config(id)
values (true)
on conflict (id) do nothing;

-- Compatibility additions if a table was created by an earlier ARKA prototype.
alter table public.platform_applications add column if not exists description text;
alter table public.platform_applications add column if not exists version text not null default '1.0';
alter table public.platform_applications add column if not exists status text not null default 'draft';
alter table public.platform_applications add column if not exists tenant_count integer not null default 0;
alter table public.platform_applications add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.platform_applications add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.platform_applications add column if not exists created_at timestamptz not null default now();
alter table public.platform_applications add column if not exists updated_at timestamptz not null default now();

alter table public.platform_integrations add column if not exists description text;
alter table public.platform_integrations add column if not exists version text not null default '1.0';
alter table public.platform_integrations add column if not exists status text not null default 'draft';
alter table public.platform_integrations add column if not exists tenant_count integer not null default 0;
alter table public.platform_integrations add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.platform_integrations add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.platform_integrations add column if not exists created_at timestamptz not null default now();
alter table public.platform_integrations add column if not exists updated_at timestamptz not null default now();

alter table public.platform_agents add column if not exists description text;
alter table public.platform_agents add column if not exists capabilities text[] not null default '{}';
alter table public.platform_agents add column if not exists tools text[] not null default '{}';
alter table public.platform_agents add column if not exists models text[] not null default '{}';
alter table public.platform_agents add column if not exists permissions text[] not null default '{}';
alter table public.platform_agents add column if not exists policies text[] not null default '{}';
alter table public.platform_agents add column if not exists version text not null default '1.0';
alter table public.platform_agents add column if not exists status text not null default 'draft';
alter table public.platform_agents add column if not exists deployment_status text not null default 'undeployed';
alter table public.platform_agents add column if not exists tenant_availability text not null default 'none';
alter table public.platform_agents add column if not exists tenant_count integer not null default 0;
alter table public.platform_agents add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.platform_agents add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.platform_agents add column if not exists created_at timestamptz not null default now();
alter table public.platform_agents add column if not exists updated_at timestamptz not null default now();

alter table public.platform_config add column if not exists maintenance_mode boolean not null default false;
alter table public.platform_config add column if not exists allow_new_signups boolean not null default true;
alter table public.platform_config add column if not exists default_region text not null default 'default';
alter table public.platform_config add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.platform_config add column if not exists updated_at timestamptz not null default now();

create or replace function public.arka_platform_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_action text;
begin
  v_id := coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'));
  v_action := case
    when tg_op = 'INSERT' then 'platform_created'
    when tg_op = 'UPDATE' then 'platform_modified'
    when tg_op = 'DELETE' then 'platform_deleted'
  end;

  insert into public.audit_logs(actor_id, tenant_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    null,
    v_action,
    tg_table_name,
    v_id,
    jsonb_build_object('operation', tg_op)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists platform_applications_audit on public.platform_applications;
create trigger platform_applications_audit
after insert or update or delete on public.platform_applications
for each row execute function public.arka_platform_audit_trigger();

drop trigger if exists platform_integrations_audit on public.platform_integrations;
create trigger platform_integrations_audit
after insert or update or delete on public.platform_integrations
for each row execute function public.arka_platform_audit_trigger();

drop trigger if exists platform_agents_audit on public.platform_agents;
create trigger platform_agents_audit
after insert or update or delete on public.platform_agents
for each row execute function public.arka_platform_audit_trigger();

drop trigger if exists platform_config_audit on public.platform_config;
create trigger platform_config_audit
after update on public.platform_config
for each row execute function public.arka_platform_audit_trigger();


-- Extend the same immutable audit trail to core control-plane mutations.
do $$
begin
  if to_regclass('public.tenants') is not null then
    execute 'drop trigger if exists tenants_platform_audit on public.tenants';
    execute 'create trigger tenants_platform_audit after insert or update or delete on public.tenants for each row execute function public.arka_platform_audit_trigger()';
  end if;
  if to_regclass('public.profiles') is not null then
    execute 'drop trigger if exists profiles_platform_audit on public.profiles';
    execute 'create trigger profiles_platform_audit after insert or update or delete on public.profiles for each row execute function public.arka_platform_audit_trigger()';
  end if;
  if to_regclass('public.roles') is not null then
    execute 'drop trigger if exists roles_platform_audit on public.roles';
    execute 'create trigger roles_platform_audit after insert or update or delete on public.roles for each row execute function public.arka_platform_audit_trigger()';
  end if;
  if to_regclass('public.user_tenant_memberships') is not null then
    execute 'drop trigger if exists memberships_platform_audit on public.user_tenant_memberships';
    execute 'create trigger memberships_platform_audit after insert or update or delete on public.user_tenant_memberships for each row execute function public.arka_platform_audit_trigger()';
  end if;
  if to_regclass('public.invitations') is not null then
    execute 'drop trigger if exists invitations_platform_audit on public.invitations';
    execute 'create trigger invitations_platform_audit after insert or update or delete on public.invitations for each row execute function public.arka_platform_audit_trigger()';
  end if;
end $$;

alter table public.platform_applications enable row level security;
alter table public.platform_integrations enable row level security;
alter table public.platform_agents enable row level security;
alter table public.platform_config enable row level security;

drop policy if exists platform_applications_super_admin on public.platform_applications;
create policy platform_applications_super_admin on public.platform_applications
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists platform_integrations_super_admin on public.platform_integrations;
create policy platform_integrations_super_admin on public.platform_integrations
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists platform_agents_super_admin on public.platform_agents;
create policy platform_agents_super_admin on public.platform_agents
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists platform_config_super_admin on public.platform_config;
create policy platform_config_super_admin on public.platform_config
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Keep timestamps current.
create or replace function public.arka_touch_platform_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists platform_applications_touch on public.platform_applications;
create trigger platform_applications_touch before update on public.platform_applications for each row execute function public.arka_touch_platform_updated_at();
drop trigger if exists platform_integrations_touch on public.platform_integrations;
create trigger platform_integrations_touch before update on public.platform_integrations for each row execute function public.arka_touch_platform_updated_at();
drop trigger if exists platform_agents_touch on public.platform_agents;
create trigger platform_agents_touch before update on public.platform_agents for each row execute function public.arka_touch_platform_updated_at();
