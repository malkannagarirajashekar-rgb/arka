# ARKA Super Admin V54

This version implements the supplied Super Admin Navigation and Super_Admin_Wireframe documents as the source of truth.

## Navigation
Dashboard; Organizations; Users; Applications; Integrations; Agents; Roles & Permissions; Platform Configuration; System Health; Audit Logs.

Each hierarchical module expands to the submodules specified in the navigation source.

## Data
Existing ARKA tables are retained:
- tenants
- profiles
- user_tenant_memberships
- invitations
- workspaces (when present)
- audit_logs

New platform-level tables:
- platform_applications
- platform_integrations
- platform_agents
- platform_config

## Required SQL
Run `supabase/migrations/20260916_0006_arka_platform_control_plane.sql` once in the Supabase SQL Editor after the existing ARKA RBAC migrations.

## Important live-data behavior
Dashboard numbers are calculated from the connected database. The sample values in the supplied wireframe are not inserted as fake production data.

Applications, Integrations and Agents use the new platform registry tables. Existing legacy `apps`, `integrations`, and `agents` tables are used as read fallbacks if the platform registry is empty.

## Existing ARKA behavior preserved
- Supabase Auth/session handling
- Super Admin access verification
- Tenant Admin onboarding
- Existing role-assignment RPC
- Existing invitation Edge Function
- Existing application routing
- Existing tenant/public UI
