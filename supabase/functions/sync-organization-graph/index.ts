import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function statements(onboarding: any, tenant: string, workspace: string | null) {
  const cloud = Array.isArray(onboarding?.cloudPresence) ? onboarding.cloudPresence : [];
  const securityTech = Array.isArray(onboarding?.securityTechnologies) ? onboarding.securityTechnologies : [];
  const priorities = Array.isArray(onboarding?.securityPriorities) ? onboarding.securityPriorities : [];
  const stack = onboarding?.securityStack ?? {};

  const result: any[] = [
    {
      statement: `MERGE (o:Organization {tenantId:$tenant})
        SET o.name=$name, o.businessVertical=$vertical, o.organizationSize=$size, o.updatedAt=datetime()
        ${workspace ? 'WITH o MERGE (w:Workspace {id:$workspace}) SET w.name=$workspaceName, w.tenantId=$tenant, w.updatedAt=datetime() MERGE (o)-[:HAS_WORKSPACE]->(w)' : ''}
        RETURN o.tenantId AS tenantId`,
      parameters: {
        tenant,
        workspace,
        name: onboarding?.organizationName ?? "",
        vertical: onboarding?.businessVertical ?? "",
        size: onboarding?.organizationSize ?? "",
        workspaceName: `${onboarding?.organizationName ?? "Organization"} Security`,
      },
    },
  ];

  for (const value of cloud) result.push({
    statement: `MATCH (o:Organization {tenantId:$tenant}) MERGE (c:CloudProvider {name:$value}) MERGE (o)-[:USES_CLOUD]->(c)`,
    parameters: { tenant, value },
  });
  for (const value of securityTech) result.push({
    statement: `MATCH (o:Organization {tenantId:$tenant}) MERGE (t:SecurityTechnology {name:$value}) MERGE (o)-[:USES_SECURITY_TECHNOLOGY]->(t)`,
    parameters: { tenant, value },
  });
  for (const [category, value] of Object.entries(stack)) if (value) result.push({
    statement: `MATCH (o:Organization {tenantId:$tenant}) MERGE (t:SecurityTool {name:$value, category:$category}) MERGE (o)-[:USES_SECURITY_TOOL]->(t)`,
    parameters: { tenant, value, category },
  });
  for (const value of priorities) result.push({
    statement: `MATCH (o:Organization {tenantId:$tenant}) MERGE (p:SecurityPriority {name:$value}) MERGE (o)-[:PRIORITIZES]->(p)`,
    parameters: { tenant, value },
  });
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const uri = Deno.env.get("NEO4J_HTTP_URL");
    const username = Deno.env.get("NEO4J_USERNAME");
    const password = Deno.env.get("NEO4J_PASSWORD");
    if (!uri || !username || !password || !body?.tenant) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Neo4j or tenant context not configured" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const response = await fetch(`${uri.replace(/\/$/, "")}/db/neo4j/tx/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Basic ${btoa(`${username}:${password}`)}` },
      body: JSON.stringify({ statements: statements(body.onboarding, body.tenant, body.workspace ?? null) }),
    });
    const payload = await response.json();
    if (!response.ok || payload?.errors?.length) throw new Error(payload?.errors?.[0]?.message || payload?.message || "Neo4j sync failed");
    return new Response(JSON.stringify({ ok: true, graph: payload }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
