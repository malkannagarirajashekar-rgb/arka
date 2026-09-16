-- ARKA V46 — safe onboarding-schema compatibility repair
-- Run this in Supabase SQL Editor.
-- Non-destructive: preserves existing tenant_onboarding data.

begin;

-- If an older ARKA installation already has the table, add only what is missing.
-- If it does not exist at all, create the complete table after confirming tenants exists.
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

alter table public.tenant_onboarding
  add column if not exists organization_name text,
  add column if not exists business_vertical text,
  add column if not exists organization_size text,
  add column if not exists cloud_presence jsonb not null default '[]'::jsonb,
  add column if not exists security_technologies jsonb not null default '[]'::jsonb,
  add column if not exists security_stack jsonb not null default '{}'::jsonb,
  add column if not exists security_priorities jsonb not null default '[]'::jsonb,
  add column if not exists current_step smallint not null default 1,
  add column if not exists completed boolean not null default false,
  add column if not exists step_data jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Backfill normalized fields from the snapshot used by earlier ARKA versions.
update public.tenant_onboarding
set organization_name = coalesce(nullif(organization_name, ''), step_data ->> 'organizationName'),
    business_vertical = coalesce(nullif(business_vertical, ''), step_data ->> 'businessVertical'),
    organization_size = coalesce(nullif(organization_size, ''), step_data ->> 'organizationSize'),
    cloud_presence = case
      when cloud_presence = '[]'::jsonb then coalesce(step_data -> 'cloudPresence', '[]'::jsonb)
      else cloud_presence end,
    security_technologies = case
      when security_technologies = '[]'::jsonb then coalesce(step_data -> 'securityTechnologies', '[]'::jsonb)
      else security_technologies end,
    security_stack = case
      when security_stack = '{}'::jsonb then coalesce(step_data -> 'securityStack', '{}'::jsonb)
      else security_stack end,
    security_priorities = case
      when security_priorities = '[]'::jsonb then coalesce(step_data -> 'securityPriorities', '[]'::jsonb)
      else security_priorities end,
    updated_at = now();

-- Keep the table usable by the existing authenticated client/RPC.
alter table public.tenant_onboarding enable row level security;

drop policy if exists "members read onboarding" on public.tenant_onboarding;
create policy "members read onboarding"
on public.tenant_onboarding
for select to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_tenant_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = tenant_onboarding.tenant_id
      and m.status = 'active'
  )
);

-- Writes are intentionally kept behind the SECURITY DEFINER onboarding RPC.
drop policy if exists "admins manage onboarding" on public.tenant_onboarding;

commit;
