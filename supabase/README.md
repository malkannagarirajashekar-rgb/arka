# ARKA Supabase — V33 Production RBAC

For the existing ARKA database:

1. Apply `supabase/migrations/20260916_0001_arka_final.sql` if the V31/V32 compatibility migration is not already applied.
2. Apply `supabase/migrations/20260916_0002_arka_production_rbac.sql`.
3. Bootstrap the first platform administrator by Auth UUID only (service role):

```sql
select public.provision_platform_admin('AUTH_USER_UUID');
```

4. Run `supabase/VERIFY_ARka_SETUP.sql`.

After bootstrap, existing Super Admins can promote another Auth user by UUID:

```sql
select public.promote_platform_admin('AUTH_USER_UUID');
```

Roles are never derived from Google metadata, email addresses, or other client-controlled identity fields. `profiles.is_platform_user` and active tenant memberships are the database authority. Ordinary users cannot change protected authorization fields.

`supabase/archive/` contains older compatibility artifacts and should not be executed as active migrations.
