import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "POST required" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return response({ error: "Supabase function environment is incomplete." }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return response({ error: "Authentication required." }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: caller, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller.user) return response({ error: "Authentication required." }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,is_platform_user,status")
      .eq("id", caller.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.is_platform_user || String(profile.status).toLowerCase() !== "active") return response({ error: "Only an active Super Admin can invite users." }, 403);

    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const fullName = String(body?.fullName ?? "").trim();
    const role = String(body?.role ?? "TENANT_USER").trim().toUpperCase();
    const tenantId = body?.tenantId ? String(body.tenantId) : null;
    if (!email || !email.includes("@")) return response({ error: "A valid email address is required." }, 400);
    if (!["SUPER_ADMIN", "TENANT_ADMIN", "TENANT_USER"].includes(role)) return response({ error: "Unsupported role." }, 400);
    if (role !== "SUPER_ADMIN" && !tenantId) return response({ error: "A tenant is required for tenant roles." }, 400);

    let tenantName: string | null = null;
    if (tenantId) {
      const { data: tenant, error } = await admin.from("tenants").select("id,name").eq("id", tenantId).maybeSingle();
      if (error) throw error;
      if (!tenant) return response({ error: "Selected organization does not exist." }, 400);
      tenantName = tenant.name;
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName || undefined },
    });
    if (inviteError) return response({ error: inviteError.message }, 400);
    if (!invited.user) return response({ error: "Supabase did not return the invited identity." }, 500);

    // The auth trigger normally creates the profile. Upsert also makes the workflow
    // resilient when an older ARKA database has no working profile trigger.
    const { error: upsertError } = await admin.from("profiles").upsert({
      id: invited.user.id,
      email,
      full_name: fullName || null,
      status: "active",
      role: "user",
      is_platform_user: role === "SUPER_ADMIN",
      tenant_id: role === "SUPER_ADMIN" ? null : tenantId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (upsertError) throw upsertError;

    if (role !== "SUPER_ADMIN") {
      const { data: roleRow, error: roleError } = await admin
        .from("roles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("scope", "tenant")
        .eq("code", role)
        .maybeSingle();
      if (roleError) throw roleError;
      if (!roleRow) return response({ error: `No ${role} role exists for the selected organization.` }, 400);

      const { error: membershipError } = await admin.from("user_tenant_memberships").upsert({
        user_id: invited.user.id, tenant_id: tenantId, role_id: roleRow.id, status: "active",
        invited_by: caller.user.id, joined_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,tenant_id" });
      if (membershipError) throw membershipError;
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_id: caller.user.id,
      tenant_id: tenantId,
      action: "user_invited",
      entity_type: "profile",
      entity_id: invited.user.id,
      metadata: { email, role, tenant_name: tenantName },
    });
    if (auditError) console.warn("Audit insert failed:", auditError.message);

    return response({ ok: true, userId: invited.user.id, email, role, tenantId, tenantName });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Invitation failed." }, 500);
  }
});
