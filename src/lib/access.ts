import { supabase } from "./supabase";

export type ArkaRole = "SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_USER" | string;
export type AccessState = "ACTIVE" | "PENDING_TENANT_ONBOARDING";

export type AccessContext = {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  role: ArkaRole | null;
  roleName: string | null;
  accessState: AccessState;
  onboardingRequired: boolean;
};

/**
 * Authorization is resolved server-side from the Auth UUID and database state.
 * Google/email/password provider metadata is deliberately not trusted for roles.
 */
export async function getAccessContext(): Promise<AccessContext | null> {
  if (!supabase) return null;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data, error } = await supabase.rpc("get_my_access_context");
  if (error) throw error;
  if (!data) return null;

  const role = data.role ? String(data.role).toUpperCase() : null;
  const accessState = String(data.access_state ?? "ACTIVE") as AccessState;

  return {
    userId: String(data.user_id ?? user.id),
    email: String(data.email ?? user.email ?? ""),
    fullName: String(data.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
    tenantId: data.tenant_id ? String(data.tenant_id) : null,
    role,
    roleName: data.role_name ? String(data.role_name) : null,
    accessState,
    onboardingRequired: Boolean(data.onboarding_required),
  };
}

export function roleRoute(role: ArkaRole | null) {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "TENANT_ADMIN") return "/tenant";
  return "/app";
}
