import { supabase } from "./supabase";

export type ArkaRole = "SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_USER" | string;

export type AccessContext = {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  role: ArkaRole | null;
  roleName: string | null;
};

/**
 * Resolve the signed-in user's Arka access through a SECURITY DEFINER RPC.
 * This avoids exposing role joins to the browser and avoids RLS recursion.
 * A direct-query fallback keeps the UI usable with older Arka schemas while
 * the new migration is being applied.
 */
export async function getAccessContext(): Promise<AccessContext | null> {
  if (!supabase) return null;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_my_access_context");

  if (!rpcError && rpcData) {
    return {
      userId: String(rpcData.user_id ?? user.id),
      email: String(rpcData.email ?? user.email ?? ""),
      fullName: String(rpcData.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
      tenantId: rpcData.tenant_id ? String(rpcData.tenant_id) : null,
      role: rpcData.role ? String(rpcData.role) : null,
      roleName: rpcData.role_name ? String(rpcData.role_name) : null,
    };
  }

  // Backward-compatible fallback for projects that have not run the new
  // access-context migration yet.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("user_tenant_memberships")
    .select("tenant_id, role_id, roles(code, name, scope)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const rows = (memberships ?? []) as any[];
  const member = rows.find((m) => m.roles?.scope === "platform") ?? rows[0];

  // If RLS prevents the nested role join, return a useful signed-in context
  // rather than throwing and leaving the login screen frozen.
  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
    tenantId: member?.tenant_id ? String(member.tenant_id) : null,
    role: member?.roles?.code ?? null,
    roleName: member?.roles?.name ?? null,
  };
}

export function roleRoute(role: ArkaRole | null) {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "TENANT_ADMIN") return "/tenant";
  return "/app";
}
