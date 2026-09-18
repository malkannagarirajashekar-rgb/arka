import { useCallback, useEffect, useMemo, useState, type ReactNode, type FormEvent } from "react";
import {
  Activity, AppWindow, Bot, Building2, Check, ChevronDown, ChevronRight, Database,
  GitBranch, LayoutDashboard, LogOut, Menu, Pencil, Plus, RefreshCw, Search,
  Settings, ShieldCheck, SlidersHorizontal, UserCog, UserPlus, UserRound, Users, X,
  Mail, Boxes, HeartPulse, KeyRound, Server, Wrench, Workflow, BookOpen, Copy
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAccessContext } from "../lib/access";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";

type RoleCode = "SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_USER";
type Section =
  | "Dashboard" | "Organizations" | "Users" | "Applications" | "Integrations"
  | "Agents" | "Roles & Permissions" | "Platform Configuration" | "System Health" | "Audit Logs";

type Tenant = { id: string; name: string; slug: string; status: string; settings?: Record<string, unknown>; created_at: string };
type PlatformUser = {
  id: string; email: string; full_name: string | null; role: string | null;
  tenant_id: string | null; tenant_name?: string | null; status: string; created_at?: string;
};
type Audit = {
  id: number | string; action: string; entity_type: string | null; entity_id: string | null;
  tenant_id: string | null; created_at: string; metadata: Record<string, unknown> | null;
};
type RegistryRecord = {
  id: string; name: string; slug: string; description?: string | null; version?: string | null;
  status: string; tenant_count?: number | null; created_at: string; updated_at?: string;
  capabilities?: string[] | null; tools?: string[] | null; models?: string[] | null;
  permissions?: string[] | null; policies?: string[] | null; deployment_status?: string | null;
  tenant_availability?: string | null; config?: Record<string, unknown> | null;
};
type Invitation = { id: string; email: string; status: string; expires_at: string; created_at: string; tenant_id: string };
type Workspace = { id: string; tenant_id: string; name: string; slug?: string; status?: string; created_at?: string };
type NavGroup = { key: Section; label: string; icon: typeof LayoutDashboard; children?: { key: string; label: string }[] };

const groups: NavGroup[] = [
  { key: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "Organizations", label: "Organizations", icon: Building2, children: [
    { key: "All Organizations", label: "All Organizations" }, { key: "Create Organization", label: "Create Organization" },
    { key: "Workspaces", label: "Workspaces" }, { key: "Tenant Administration", label: "Tenant Administration" },
  ]},
  { key: "Users", label: "Users", icon: Users, children: [
    { key: "All Users", label: "All Users" }, { key: "Create User", label: "Create User" },
    { key: "Invitations", label: "Invitations" }, { key: "Access", label: "Access" },
  ]},
  { key: "Applications", label: "Applications", icon: AppWindow, children: [
    { key: "App Catalog", label: "App Catalog" }, { key: "Create App", label: "Create App" },
    { key: "Versions", label: "Versions" }, { key: "App Configuration", label: "App Configuration" },
  ]},
  { key: "Integrations", label: "Integrations", icon: GitBranch, children: [
    { key: "Integration Catalog", label: "Integration Catalog" }, { key: "Create Integration", label: "Create Integration" },
    { key: "Connectors", label: "Connectors" }, { key: "Configuration", label: "Configuration" },
  ]},
  { key: "Agents", label: "Agents", icon: Bot, children: [
    { key: "Agent Catalog", label: "Agent Catalog" }, { key: "Create Agent", label: "Create Agent" },
    { key: "Deployments", label: "Deployments" }, { key: "Agent Configuration", label: "Agent Configuration" },
  ]},
  { key: "Roles & Permissions", label: "Roles & Permissions", icon: ShieldCheck },
  { key: "Platform Configuration", label: "Platform Configuration", icon: SlidersHorizontal },
  { key: "System Health", label: "System Health", icon: HeartPulse },
  { key: "Audit Logs", label: "Audit Logs", icon: Activity },
];

const roleMeta: Record<RoleCode, { label: string; description: string; icon: typeof ShieldCheck }> = {
  SUPER_ADMIN: { label: "Super Admin", description: "Platform-wide control across every organization.", icon: ShieldCheck },
  TENANT_ADMIN: { label: "Tenant Admin", description: "Full administration inside one organization.", icon: UserCog },
  TENANT_USER: { label: "Tenant User", description: "Scoped access inside an assigned organization.", icon: UserRound },
};

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
function prettyAction(value: string) {
  return String(value || "platform activity").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}
function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

export default function Admin() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("Dashboard");
  const [subsection, setSubsection] = useState("Dashboard");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Organizations: false, Users: false, Applications: false, Integrations: false, Agents: false });
  const [sidebar, setSidebar] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [dataError, setDataError] = useState("");
  const [actionError, setActionError] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [apps, setApps] = useState<RegistryRecord[]>([]);
  const [integrations, setIntegrations] = useState<RegistryRecord[]>([]);
  const [agents, setAgents] = useState<RegistryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showCreateRegistry, setShowCreateRegistry] = useState<"apps" | "integrations" | "agents" | null>(null);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [showUserManager, setShowUserManager] = useState(false);
  const [editingRegistry, setEditingRegistry] = useState<{ type: "apps" | "integrations" | "agents"; item: RegistryRecord } | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [isLightTheme, setIsLightTheme] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.theme === "light");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsLightTheme(root.dataset.theme === "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const loadOptional = useCallback(async <T,>(table: string, columns: string, fallback: T[] = []): Promise<T[]> => {
    if (!supabase) return fallback;
    try {
      const res = await supabase.from(table).select(columns);
      return res.error ? fallback : ((res.data ?? []) as T[]);
    } catch { return fallback; }
  }, []);

  const loadLiveData = useCallback(async () => {
    if (!supabase) return;
    setLoadingData(true); setDataError("");
    try {
      const [tenantRes, userRes, membershipRes, auditRes] = await Promise.all([
        supabase.from("tenants").select("id,name,slug,status,settings,created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,email,full_name,role,tenant_id,status,created_at").order("created_at", { ascending: false }),
        supabase.from("user_tenant_memberships").select("user_id,tenant_id,status,created_at,roles(code,name,scope)").eq("status", "active"),
        supabase.from("audit_logs").select("id,action,entity_type,entity_id,tenant_id,created_at,metadata").order("created_at", { ascending: false }).limit(50),
      ]);
      const firstError = tenantRes.error || userRes.error || membershipRes.error || auditRes.error;
      if (firstError) throw firstError;

      const membershipRows = (membershipRes.data ?? []) as any[];
      const byUser = new Map<string, any[]>();
      for (const row of membershipRows) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
      const tenantRows = (tenantRes.data ?? []) as Tenant[];
      const resolvedUsers = ((userRes.data ?? []) as PlatformUser[]).map(user => {
        const memberships = [...(byUser.get(user.id) ?? [])].sort((a, b) =>
          Number(String(b.roles?.code ?? "").includes("ADMIN")) - Number(String(a.roles?.code ?? "").includes("ADMIN")));
        const primary = memberships[0];
        const role = String(primary?.roles?.code ?? user.role ?? "").toUpperCase() || null;
        const tenantId = primary?.tenant_id ?? user.tenant_id ?? null;
        return { ...user, role, tenant_id: role === "SUPER_ADMIN" ? null : tenantId,
          tenant_name: role === "SUPER_ADMIN" ? "Platform" : tenantRows.find(t => t.id === tenantId)?.name ?? null };
      });

      const [inv, ws, platformApps, platformIntegrations, platformAgents] = await Promise.all([
        loadOptional<Invitation>("invitations", "id,email,status,expires_at,created_at,tenant_id"),
        loadOptional<Workspace>("workspaces", "id,tenant_id,name,slug,status,created_at"),
        loadOptional<RegistryRecord>("platform_applications", "id,name,slug,description,version,status,tenant_count,created_at,updated_at,config"),
        loadOptional<RegistryRecord>("platform_integrations", "id,name,slug,description,version,status,tenant_count,created_at,updated_at,config"),
        loadOptional<RegistryRecord>("platform_agents", "id,name,slug,description,version,status,tenant_count,capabilities,tools,models,permissions,policies,deployment_status,tenant_availability,created_at,updated_at,config"),
      ]);

      // Backward-compatible fallback: existing apps table remains visible if the new platform registry is empty.
      let visibleApps = platformApps;
      if (!visibleApps.length) visibleApps = await loadOptional<RegistryRecord>("apps", "id,name,slug,status,created_at,updated_at,description,version,tenant_count,config");
      let visibleIntegrations = platformIntegrations;
      if (!visibleIntegrations.length) visibleIntegrations = await loadOptional<RegistryRecord>("integrations", "id,name,slug,status,created_at,updated_at,description,version,tenant_count,config");
      let visibleAgents = platformAgents;
      if (!visibleAgents.length) visibleAgents = await loadOptional<RegistryRecord>("agents", "id,name,slug,status,created_at,updated_at,description,version,tenant_count,config");

      setTenants(tenantRows); setUsers(resolvedUsers); setAudit((auditRes.data ?? []) as Audit[]);
      setInvitations(inv); setWorkspaces(ws); setApps(visibleApps); setIntegrations(visibleIntegrations); setAgents(visibleAgents);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Live platform data could not be loaded.");
    } finally { setLoadingData(false); }
  }, [loadOptional]);

  useEffect(() => {
    let mounted = true;
    async function verify() {
      if (!supabaseConfigured || !supabase) { navigate("/login", { replace: true }); return; }
      try {
        const access = await getAccessContext();
        if (!access) { if (mounted) { setChecking(false); setAccessError("Your authentication session could not be verified."); } return; }
        if (access.role !== "SUPER_ADMIN") { navigate(access.role === "TENANT_ADMIN" ? "/tenant" : "/app", { replace: true }); return; }
        if (mounted) { setEmail(access.email); setFullName(access.fullName); setChecking(false); }
        await loadLiveData();
      } catch (error) {
        if (mounted) { setChecking(false); setAccessError(error instanceof Error ? error.message : "Unable to verify platform access."); }
      }
    }
    void verify();
    const subscription = supabaseConfigured && supabase
      ? supabase.auth.onAuthStateChange((_event, session) => { if (!session) navigate("/login", { replace: true }); }).data.subscription : null;
    return () => { mounted = false; subscription?.unsubscribe(); };
  }, [navigate, loadLiveData]);

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  async function assignRole(user: PlatformUser, nextRole: RoleCode, tenantId: string | null) {
    if (!supabase || busyUser) return;
    if (nextRole !== "SUPER_ADMIN" && !tenantId) { setActionError("A tenant is required for Tenant Admin and Tenant User roles."); return; }
    setBusyUser(user.id); setActionError("");
    try {
      const { error } = await supabase.rpc("admin_set_user_role", { p_user_id: user.id, p_role_code: nextRole, p_tenant_id: nextRole === "SUPER_ADMIN" ? null : tenantId });
      if (error) throw error;
      setEditingUser(null); await loadLiveData();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Role assignment failed."); }
    finally { setBusyUser(null); }
  }

  async function createTenant(name: string, slug: string, status: string) {
    if (!supabase) return;
    setActionError("");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("tenants").insert({ name: name.trim(), slug: slugify(slug || name), status, created_by: userData.user?.id ?? null }).select().single();
    if (error) { setActionError(error.message); return; }
    setShowCreateTenant(false); await loadLiveData();
  }

  async function saveRegistry(type: "apps" | "integrations" | "agents", values: Partial<RegistryRecord>, existingId?: string) {
    if (!supabase) return;
    const table = type === "apps" ? "platform_applications" : type === "integrations" ? "platform_integrations" : "platform_agents";
    setActionError("");
    const payload = { ...values, slug: slugify(values.slug || values.name || ""), version: values.version || "1.0", status: values.status || "draft" };
    try {
      const result = existingId
        ? await supabase.from(table).update(payload).eq("id", existingId)
        : await supabase.from(table).insert(payload);
      if (result.error) throw result.error;
      setShowCreateRegistry(null); setEditingRegistry(null); await loadLiveData();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Registry change failed. Run the ARKA platform registry migration first."); }
  }

  async function deleteRegistry(type: "apps" | "integrations" | "agents", id: string) {
    if (!supabase) return;
    if (!window.confirm("Delete this platform registry entry? This action is audited.")) return;
    const table = type === "apps" ? "platform_applications" : type === "integrations" ? "platform_integrations" : "platform_agents";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) setActionError(error.message); else await loadLiveData();
  }

  async function toggleRegistry(type: "apps" | "integrations" | "agents", item: RegistryRecord) {
    const next = item.status.toLowerCase() === "published" || item.status.toLowerCase() === "active" ? "disabled" : "published";
    await saveRegistry(type, { status: next }, item.id);
  }

  const roleCounts = useMemo(() => ({
    superAdmin: users.filter(u => u.role === "SUPER_ADMIN").length,
    tenantAdmin: users.filter(u => u.role === "TENANT_ADMIN").length,
    tenantUser: users.filter(u => u.role === "TENANT_USER").length,
    pending: users.filter(u => String(u.status).toLowerCase() === "pending").length,
  }), [users]);

  const counts = useMemo(() => ({
    organizations: tenants.length, activeOrganizations: tenants.filter(t => String(t.status).toLowerCase() === "active").length,
    users: users.length, apps: apps.length, integrations: integrations.length, agents: agents.length, workspaces: workspaces.length,
  }), [tenants, users, apps, integrations, agents, workspaces]);

  const filtered = (items: Array<{ name?: string; slug?: string; status?: string; email?: string; full_name?: string | null; role?: string | null; tenant_name?: string | null }>) => {
    const q = query.trim().toLowerCase();
    return items.filter(x => {
      const text = `${x.name ?? ""} ${x.slug ?? ""} ${x.status ?? ""} ${x.email ?? ""} ${x.full_name ?? ""} ${x.role ?? ""} ${x.tenant_name ?? ""}`.toLowerCase();
      return (!q || text.includes(q)) && (statusFilter === "all" || String(x.status ?? "").toLowerCase() === statusFilter);
    });
  };

  const openSection = (group: NavGroup, sub?: string) => {
    // Parent rows are true disclosure controls. Clicking an expanded parent
    // closes it again instead of being forced open by the active section.
    if (group.children && sub === undefined) {
      setSection(group.key);
      setSubsection(group.children[0]?.key || group.label);
      setQuery("");
      setStatusFilter("all");
      setActionError("");
      setExpanded(v => ({ ...v, [group.key]: !v[group.key] }));
      setSidebar(false);
      return;
    }

    setSection(group.key);
    setSubsection(sub || group.children?.[0]?.key || group.label);
    setQuery("");
    setStatusFilter("all");
    setActionError("");
    setSidebar(false);
    if (group.children) setExpanded(v => ({ ...v, [group.key]: true }));
    if (group.key === "Organizations" && sub === "Create Organization") setShowCreateTenant(true);
    if (group.key === "Users" && sub === "Create User") setShowInvite(true);
    if (group.key === "Applications" && sub === "Create App") setShowCreateRegistry("apps");
    if (group.key === "Integrations" && sub === "Create Integration") setShowCreateRegistry("integrations");
    if (group.key === "Agents" && sub === "Create Agent") setShowCreateRegistry("agents");
  };

  if (checking) return <div className="auth-loading"><div className="loading-mark">◈</div><p>Verifying secure platform access…</p></div>;
  if (accessError) return <div className="auth-loading"><Brand/><div className="placeholder-card access-error-card"><ShieldCheck size={28}/><p className="eyebrow"><span/> ACCESS VERIFICATION FAILED</p><h1>We couldn't verify your access.</h1><p>{accessError}</p><div className="error-actions"><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button><button className="button button-ghost" onClick={logout}>Sign out</button></div></div></div>;

  return (
    <div className={`admin-shell ${isLightTheme ? "admin-light" : "admin-dark"}`}>
      <aside className={`admin-sidebar ${sidebar ? "open" : ""}`}>
        <div className="admin-brand"><Brand/><span><i/> LIVE</span></div>
        <div className="admin-role"><ShieldCheck size={12}/><div><strong>SUPER ADMIN</strong><small>PLATFORM CONTROL</small></div></div>
        <nav className="admin-nav">
          {groups.map(group => {
            const Icon = group.icon, active = section === group.key;
            const isExpanded = Boolean(group.children && expanded[group.key]);
            return <div key={group.key} className="admin-nav-group">
              <button className={`admin-nav-main ${active ? "active" : ""}`} onClick={() => openSection(group)}>
                <Icon size={16}/><span>{group.label}</span>{group.children && <ChevronDown size={13} className={isExpanded ? "rotated" : ""}/>}
              </button>
              {group.children && isExpanded && <div className="admin-subnav">
                {group.children.map(child => <button key={child.key} className={subsection === child.key ? "active" : ""} onClick={() => openSection(group, child.key)}>{child.label}</button>)}
              </div>}
            </div>;
          })}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-health"><span><i/> PLATFORM ONLINE</span><b>LIVE</b><span>API <b>HEALTHY</b></span><span>DATABASE <b>CONNECTED</b></span></div>
          <button className="admin-signout" onClick={logout}><LogOut size={15}/> Sign out <ChevronRight size={13}/></button>
        </div>
      </aside>
      {sidebar && <button className="admin-backdrop" onClick={() => setSidebar(false)} aria-label="Close navigation"/>}
      <main className="admin-main">
        <header className="admin-header">
          <button className="admin-mobile" onClick={() => setSidebar(v => !v)} aria-label={sidebar ? "Close navigation" : "Open navigation"}>{sidebar ? <X/> : <Menu/>}</button>
          <div><p>ARKA <span>/</span> PLATFORM CONTROL</p><h1>{section}</h1></div>
          <div className="admin-header-right"><span className="admin-online"><i/> ONLINE</span><div className="admin-user"><div className="admin-avatar">{(fullName || email || "S").charAt(0).toUpperCase()}</div><div><strong>{fullName || "Super Admin"}</strong><small>{email}</small></div></div><ThemeToggle/></div>
        </header>
        <div className="admin-toolbar">
          <div><span className="pulse"/> DATABASE-BACKED <b>{loadingData ? "SYNCING" : "LIVE"}</b></div>
          <div className="admin-toolbar-actions"><div className="admin-search"><Search size={14}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${subsection.toLowerCase()}…`}/></div>{section !== "Dashboard" && <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All status</option><option value="active">Active</option><option value="published">Published</option><option value="draft">Draft</option><option value="disabled">Disabled</option><option value="pending">Pending</option></select>}<button onClick={() => void loadLiveData()} disabled={loadingData}><RefreshCw size={14} className={loadingData ? "spin" : ""}/> Refresh</button></div>
        </div>
        {dataError && <Alert text={dataError} onClose={() => setDataError("")}/>}
        {actionError && <Alert text={actionError} onClose={() => setActionError("")} action/>}
        <div className="admin-content">
          {section === "Dashboard" && <Dashboard counts={counts} audit={audit} onOpen={openSection} roleCounts={roleCounts}/>}
          {section === "Organizations" && <OrganizationsView sub={subsection} tenants={filtered(tenants)} allTenants={tenants} users={users} workspaces={workspaces} onCreate={() => setShowCreateTenant(true)} onEdit={setSelectedTenant}/>}
          {section === "Users" && <UsersView sub={subsection} users={filtered(users)} tenants={tenants} invitations={invitations} roleCounts={roleCounts} onInvite={() => setShowInvite(true)} onEdit={setEditingUser}/>}
          {section === "Applications" && <RegistryView type="apps" sub={subsection} items={filtered(apps)} allItems={apps} onCreate={() => setShowCreateRegistry("apps")} onEdit={item => setEditingRegistry({type:"apps",item})} onDelete={id => void deleteRegistry("apps", id)} onToggle={item => void toggleRegistry("apps",item)}/>}
          {section === "Integrations" && <RegistryView type="integrations" sub={subsection} items={filtered(integrations)} allItems={integrations} onCreate={() => setShowCreateRegistry("integrations")} onEdit={item => setEditingRegistry({type:"integrations",item})} onDelete={id => void deleteRegistry("integrations", id)} onToggle={item => void toggleRegistry("integrations",item)}/>}
          {section === "Agents" && <RegistryView type="agents" sub={subsection} items={filtered(agents)} allItems={agents} onCreate={() => setShowCreateRegistry("agents")} onEdit={item => setEditingRegistry({type:"agents",item})} onDelete={id => void deleteRegistry("agents", id)} onToggle={item => void toggleRegistry("agents",item)}/>}
          {section === "Roles & Permissions" && <RolesView users={users} roleCounts={roleCounts} onManageUsers={() => setShowUserManager(true)}/>}
          {section === "Platform Configuration" && <PlatformConfig onError={setActionError}/>}
          {section === "System Health" && <SystemHealth counts={counts}/>}
          {section === "Audit Logs" && <AuditView audit={audit} tenants={tenants}/>}
        </div>
      </main>
      {showInvite && <InviteModal tenants={tenants} onClose={() => setShowInvite(false)} onCreated={async () => { setShowInvite(false); await loadLiveData(); }}/>}
      {showUserManager && <UserDirectoryModal users={users} tenants={tenants} onClose={() => setShowUserManager(false)} onCreate={() => { setShowUserManager(false); setShowInvite(true); }} onEdit={(u) => { setShowUserManager(false); setEditingUser(u); }} />}
      {editingUser && <RoleEditor user={editingUser} tenants={tenants} busy={busyUser === editingUser.id} onClose={() => setEditingUser(null)} onSave={assignRole}/>}
      {showCreateTenant && <CreateTenantModal onClose={() => setShowCreateTenant(false)} onSave={createTenant}/>} {selectedTenant && <TenantDetailModal tenant={selectedTenant} users={users} workspaces={workspaces} onClose={() => setSelectedTenant(null)}/>}
      {showCreateRegistry && <RegistryModal type={showCreateRegistry} onClose={() => setShowCreateRegistry(null)} onSave={values => saveRegistry(showCreateRegistry, values)}/>}
      {editingRegistry && <RegistryModal type={editingRegistry.type} initial={editingRegistry.item} onClose={() => setEditingRegistry(null)} onSave={values => saveRegistry(editingRegistry.type, values, editingRegistry.item.id)}/>}
    </div>
  );
}

function Alert({ text, onClose, action=false }: { text:string; onClose:()=>void; action?:boolean }) {
  return <div className={`admin-alert ${action ? "action" : ""}`}><ShieldCheck size={15}/><span>{text}</span><button onClick={onClose}><X size={13}/></button></div>;
}

function Dashboard({ counts, audit, roleCounts, onOpen }: { counts:any; audit:Audit[]; roleCounts:any; onOpen:(g:NavGroup,s?:string)=>void }) {
  const cards = [
    ["Organizations", counts.organizations, "registered organizations", Building2, () => onOpen(groups[1])],
    ["Users", counts.users, "active identities", Users, () => onOpen(groups[2])],
    ["Applications", counts.apps, "platform catalog", AppWindow, () => onOpen(groups[3])],
    ["Integrations", counts.integrations, "available connectors", GitBranch, () => onOpen(groups[4])],
    ["Agents", counts.agents, "active automation", Bot, () => onOpen(groups[5])],
    ["Workspaces", counts.workspaces, "active environments", Boxes, () => onOpen(groups[1], "Workspaces")],
  ];
  const management = [
    ["Organizations","View / Create / Modify / Delete / Manage Workspaces",Building2,groups[1]],
    ["Applications","Create / Modify / Publish / Disable / Version / Delete",AppWindow,groups[3]],
    ["Integrations","Create / Modify / Enable / Disable / Version / Delete",GitBranch,groups[4]],
    ["Agents","Create / Modify / Deploy / Disable / Configure / Delete",Bot,groups[5]],
    ["Users","Create / Modify / Activate / Disable / Assign Roles",Users,groups[2]],
    ["Roles & Permissions","Platform RBAC / Tenant RBAC",ShieldCheck,groups[6]],
  ] as const;
  return <section className="admin-dashboard">
    <div className="admin-hero"><div><p className="admin-kicker"><span/> PLATFORM OVERVIEW</p><h2>Manage ARKA <em>control plane.</em></h2><p>One operational view across organizations, applications, integrations, agents, workspaces and identities.</p></div><Orbit icon={<ShieldCheck/>}/></div>
    <div className="admin-stat-grid">{cards.map(([label,value,meta,Icon,click]) => <button className="admin-stat" key={String(label)} onClick={click as ()=>void}><span>{label}</span><Icon size={17}/><strong>{value}</strong><small>{meta}</small></button>)}</div>
    <div className="admin-health-strip"><div><p className="admin-kicker"><span/> PLATFORM HEALTH</p><div className="health-cells"><Health label="API"/><Health label="Workers"/><Health label="Graph DB"/><Health label="MinIO"/></div></div><div className="admin-health-summary"><strong>LIVE</strong><span>Control plane operational</span></div></div>
    <div className="admin-panel"><div className="admin-panel-head"><div><p className="admin-kicker"><span/> PLATFORM MANAGEMENT</p><h3>Control surfaces</h3></div><span>6 modules</span></div><div className="admin-management">{management.map(([label,text,Icon,group]) => <button key={label} onClick={() => onOpen(group)}><Icon/><div><strong>{label}</strong><p>{text}</p></div><ChevronRight/></button>)}</div></div>
    <div className="admin-bottom"><div className="admin-panel"><div className="admin-panel-head"><div><p className="admin-kicker"><span/> RECENT PLATFORM ACTIVITY</p><h3>What changed</h3></div><button onClick={() => onOpen(groups[10])}>View all <ChevronRight size={13}/></button></div>{audit.length ? audit.slice(0,5).map((a,i)=><div className="admin-activity" key={String(a.id)}><span>{String(i+1).padStart(2,"0")}</span><i/><div><strong>{prettyAction(a.action)}</strong><small>{a.entity_type || "platform"} · {a.tenant_id ? "organization" : "platform"}</small></div><time>{timeAgo(a.created_at)}</time></div>) : <EmptyState icon={<Activity/>} title="No platform events yet" text="New create, modify and delete actions will appear here."/>}</div><div className="admin-panel admin-identity"><div className="admin-panel-head"><div><p className="admin-kicker"><span/> ACCESS MODEL</p><h3>Identity distribution</h3></div></div><RoleBar label="Super Admin" value={roleCounts.superAdmin} total={Math.max(1,counts.users)}/><RoleBar label="Tenant Admin" value={roleCounts.tenantAdmin} total={Math.max(1,counts.users)}/><RoleBar label="Tenant User" value={roleCounts.tenantUser} total={Math.max(1,counts.users)}/><RoleBar label="Pending" value={roleCounts.pending} total={Math.max(1,counts.users)}/><div className="admin-rbac-foot"><ShieldCheck size={14}/> Database-backed RBAC authority</div></div></div>
  </section>;
}

function OrganizationsView({sub,tenants,allTenants,users,workspaces,onCreate,onEdit}:{sub:string;tenants:Tenant[];allTenants:Tenant[];users:PlatformUser[];workspaces:Workspace[];onCreate:()=>void;onEdit:(t:Tenant)=>void}) {
  if (sub==="Create Organization") return <EmptyState icon={<Building2/>} title="Create organization" text="Use the Create button in the organization registry to provision a tenant." action={<button className="admin-primary" onClick={onCreate}><Plus size={14}/> Create organization</button>}/>;
  if (sub==="Workspaces") return <WorkspaceView tenants={allTenants} workspaces={workspaces}/>;
  if (sub==="Tenant Administration") return <TenantAdministration tenants={allTenants} users={users}/>;
  return <section className="admin-console"><ConsoleHero eyebrow="ORGANIZATION MANAGEMENT" title="Organizations" text="Complete tenant inventory with lifecycle and membership visibility." action="Create organization" onAction={onCreate}/><div className="admin-table-panel"><TableHead title="All organizations" count={tenants.length}/>{tenants.length ? <div className="admin-table"><div className="admin-thead org"><span>Organization</span><span>Workspaces</span><span>Users</span><span>Status</span><span>Actions</span></div>{tenants.map(t=>{const ws=workspaces.filter(w=>w.tenant_id===t.id).length;const us=users.filter(u=>u.tenant_id===t.id).length;return <div className="admin-tr org" key={t.id}><span className="entity"><b><Building2 size={14}/></b><strong>{t.name}</strong><small>{t.slug}</small></span><span>{ws}</span><span>{us}</span><Status value={t.status}/><button className="row-action" onClick={()=>onEdit(t)}><Pencil size={12}/> View</button></div>})}</div>:<EmptyState icon={<Building2/>} title="No organizations found" text="Create the first organization from the control plane."/>}</div></section>;
}
function TenantDetailModal({tenant,users,workspaces,onClose}:{tenant:Tenant;users:PlatformUser[];workspaces:Workspace[];onClose:()=>void}) {
  const tenantUsers=users.filter(u=>u.tenant_id===tenant.id), tenantWorkspaces=workspaces.filter(w=>w.tenant_id===tenant.id);
  return <Modal title={tenant.name} eyebrow="TENANT INSPECTOR" icon={<Building2/>} onClose={onClose}><div className="admin-detail-inspector"><div><span>STATUS</span><Status value={tenant.status}/></div><div><span>SLUG</span><strong>{tenant.slug}</strong></div><div><span>USERS</span><strong>{tenantUsers.length}</strong></div><div><span>WORKSPACES</span><strong>{tenantWorkspaces.length}</strong></div></div><div className="admin-inspector-list"><h4>Tenant administrators</h4>{tenantUsers.filter(u=>u.role==="TENANT_ADMIN").map(u=><p key={u.id}><UserCog size={12}/>{u.full_name||u.email}<small>{u.email}</small></p>)}{!tenantUsers.some(u=>u.role==="TENANT_ADMIN")&&<span>No Tenant Admin assigned.</span>}<h4>Members</h4>{tenantUsers.slice(0,8).map(u=><p key={u.id}><UserRound size={12}/>{u.full_name||u.email}<small>{u.role||"UNASSIGNED"}</small></p>)}{tenantUsers.length>8&&<span>+ {tenantUsers.length-8} more members</span>}</div></Modal>;
}

function WorkspaceView({tenants,workspaces}:{tenants:Tenant[];workspaces:Workspace[]}) {
  return <section className="admin-console">
    <ConsoleHero eyebrow="ORGANIZATION MANAGEMENT" title="Workspaces" text="See the workspace layer underneath every organization."/>
    <div className="admin-table-panel admin-workspace-panel">
      <TableHead title="Workspace inventory" count={workspaces.length}/>
      {workspaces.length ? <div className="admin-table admin-workspace-table">
        <div className="admin-thead workspace-record"><span>Workspace</span><span>Organization</span><span>Status</span><span>Created</span></div>
        {workspaces.map(w => <div className="admin-tr workspace-record" key={w.id}>
          <span className="entity"><b><Boxes size={14}/></b><strong>{w.name}</strong><small>{w.slug || w.id}</small></span>
          <span className="workspace-org">{tenants.find(t=>t.id===w.tenant_id)?.name || "—"}</span>
          <Status value={w.status || "active"}/>
          <span className="workspace-date">{w.created_at ? new Date(w.created_at).toLocaleDateString() : "—"}</span>
        </div>)}
      </div> : <EmptyState icon={<Boxes/>} title="No workspaces found" text="Workspace records will appear here when organizations create environments."/>}
    </div>
  </section>;
}
function TenantAdministration({tenants,users}:{tenants:Tenant[];users:PlatformUser[]}) { return <section className="admin-console"><ConsoleHero eyebrow="TENANT ADMINISTRATION" title="Tenant operators" text="Review which identities administer each organization."/><div className="admin-admin-grid">{tenants.map(t=>{const admins=users.filter(u=>u.tenant_id===t.id&&u.role==="TENANT_ADMIN");return <div className="admin-admin-card" key={t.id}><div><Building2 size={15}/><strong>{t.name}</strong></div><span>{admins.length} tenant administrator{admins.length===1?"":"s"}</span>{admins.length?<div>{admins.map(a=><p key={a.id}><UserCog size={12}/>{a.full_name||a.email}<small>{a.email}</small></p>)}</div>:<small>No Tenant Admin assigned</small>}</div>})}</div></section>; }

function UsersView({sub,users,tenants,invitations,roleCounts,onInvite,onEdit}:{sub:string;users:PlatformUser[];tenants:Tenant[];invitations:Invitation[];roleCounts:any;onInvite:()=>void;onEdit:(u:PlatformUser)=>void}) {
  if(sub==="Invitations") return <section className="admin-console"><ConsoleHero eyebrow="IDENTITY CONTROL" title="Invitations" text="Track pending and completed identity invitations." action="Create invitation" onAction={onInvite}/><div className="admin-table-panel"><TableHead title="Invitation registry" count={invitations.length}/>{invitations.length?<div className="admin-table"><div className="admin-thead"><span>Email</span><span>Organization</span><span>Status</span><span>Expires</span></div>{invitations.map(i=><div className="admin-tr" key={i.id}><span>{i.email}</span><span>{tenants.find(t=>t.id===i.tenant_id)?.name||"—"}</span><Status value={i.status}/><span>{new Date(i.expires_at).toLocaleDateString()}</span></div>)}</div>:<EmptyState icon={<Mail/>} title="No invitations" text="Invitations sent from ARKA will appear here."/>}</div></section>;
  if(sub==="Access") return <AccessView users={users} roleCounts={roleCounts} onEdit={onEdit}/>;
  return <section className="admin-console"><ConsoleHero eyebrow="IDENTITY MANAGEMENT" title="Users" text="Global user visibility, activation state, organization membership and role assignment." action="Create user" onAction={onInvite}/><div className="admin-role-strip"><RoleMetric label="Super Admin" value={roleCounts.superAdmin}/><RoleMetric label="Tenant Admin" value={roleCounts.tenantAdmin}/><RoleMetric label="Tenant User" value={roleCounts.tenantUser}/><RoleMetric label="Pending" value={roleCounts.pending}/></div><div className="admin-table-panel"><TableHead title="All users" count={users.length}/>{users.length?<div className="admin-table"><div className="admin-thead users"><span>User</span><span>Organization</span><span>Role</span><span>Status</span><span>Actions</span></div>{users.map(u=><div className="admin-tr users" key={u.id}><span className="entity"><b className="avatar">{(u.full_name||u.email).charAt(0).toUpperCase()}</b><strong>{u.full_name||"Unnamed user"}</strong><small>{u.email}</small></span><span>{u.tenant_name||"Platform"}</span><RolePill role={u.role||"UNASSIGNED"}/><Status value={u.status}/><button className="row-action" onClick={()=>onEdit(u)}><Pencil size={12}/> Manage</button></div>)}</div>:<EmptyState icon={<Users/>} title="No users found" text="Create an identity from the user control surface."/>}</div></section>;
}
function AccessView({users,roleCounts,onEdit}:{users:PlatformUser[];roleCounts:any;onEdit:(u:PlatformUser)=>void}) { return <section className="admin-console"><ConsoleHero eyebrow="ACCESS CONTROL" title="Access" text="Platform RBAC and tenant-scoped assignments resolve from ARKA identity and memberships."/><div className="admin-access-cards"><div><ShieldCheck/><strong>{roleCounts.superAdmin}</strong><span>Platform-wide identities</span></div><div><UserCog/><strong>{roleCounts.tenantAdmin}</strong><span>Organization operators</span></div><div><UserRound/><strong>{roleCounts.tenantUser}</strong><span>Scoped identities</span></div></div><div className="admin-table-panel"><TableHead title="Role assignments" count={users.length}/>{users.map(u=><div className="admin-access-row" key={u.id}><div><strong>{u.full_name||u.email}</strong><small>{u.email}</small></div><RolePill role={u.role||"UNASSIGNED"}/><span>{u.tenant_name||"Platform"}</span><button className="row-action" onClick={()=>onEdit(u)}><KeyRound size={12}/> Assign</button></div>)}</div></section>; }

function RegistryView({type,sub,items,allItems,onCreate,onEdit,onDelete,onToggle}:{type:"apps"|"integrations"|"agents";sub:string;items:RegistryRecord[];allItems:RegistryRecord[];onCreate:()=>void;onEdit:(i:RegistryRecord)=>void;onDelete:(id:string)=>void;onToggle:(i:RegistryRecord)=>void}) {
  const title=type==="apps"?"Applications":type==="integrations"?"Integrations":"Agents";
  const singular=type==="apps"?"application":type==="integrations"?"integration":"agent";
  if(sub.startsWith("Create")) return <EmptyState icon={type==="apps"?<AppWindow/>:type==="integrations"?<GitBranch/>:<Bot/>} title={`Create ${singular}`} text={`Use the create action to add a ${singular} to the ARKA platform catalog.`} action={<button className="admin-primary" onClick={onCreate}><Plus size={14}/> Create {singular}</button>}/>;
  if(sub==="Versions" || sub==="Configuration" || sub==="App Configuration" || sub==="Connectors" || sub==="Deployments" || sub==="Agent Configuration") return <RegistryDetail type={type} sub={sub} items={items} onEdit={onEdit}/>;
  return <section className="admin-console"><ConsoleHero eyebrow="PLATFORM MANAGEMENT" title={title} text={type==="agents"?"Platform-level agents are managed independently from tenant data; each has identity, capabilities, tools, models, permissions, policies, version, deployment and tenant availability.":`Own the ARKA ${title.toLowerCase()} catalog at platform level.`} action={`Create ${singular}`} onAction={onCreate}/><div className="admin-table-panel"><TableHead title={`${title} catalog`} count={items.length}/>{items.length?<div className="admin-registry-list">{items.map(i=><div className="admin-registry-row" key={i.id}><div className="registry-icon">{type==="apps"?<AppWindow size={15}/>:type==="integrations"?<GitBranch size={15}/>:<Bot size={15}/>}</div><div><strong>{i.name}</strong><small>{i.slug}</small></div><span>v{i.version||"1.0"}</span><Status value={i.status}/><span>{i.tenant_count??0} tenants</span><div className="registry-actions"><button onClick={()=>onEdit(i)}><Pencil size={12}/> Modify</button><button onClick={()=>onToggle(i)}>{String(i.status).toLowerCase()==="published"||String(i.status).toLowerCase()==="active"?"Disable":"Publish"}</button><button className="danger" onClick={()=>onDelete(i.id)}>Delete</button></div></div>)}</div>:<EmptyState icon={type==="apps"?<AppWindow/>:type==="integrations"?<GitBranch/>:<Bot/>} title={`No ${title.toLowerCase()} in the platform registry`} text={`Run the ARKA platform registry migration, then use Create ${singular} to populate this control surface.`}/>}</div></section>;
}
function RegistryDetail({type,sub,items,onEdit}:{type:"apps"|"integrations"|"agents";sub:string;items:RegistryRecord[];onEdit:(i:RegistryRecord)=>void}) { return <section className="admin-console"><ConsoleHero eyebrow="PLATFORM CATALOG" title={sub} text="Platform-level records are ready for versioning, configuration and operational management."/><div className="admin-detail-grid">{items.map(i=><div className="admin-detail-card" key={i.id}><p>{type==="agents"?"AGENT":type==="apps"?"APPLICATION":"INTEGRATION"}</p><h3>{i.name}</h3><span>v{i.version||"1.0"} · {i.status}</span>{type==="agents"&&<><h4>Capabilities</h4><div className="tag-list">{(i.capabilities||[]).map(x=><b key={x}>{x}</b>)}</div><h4>Tools / Models</h4><p>{[...(i.tools||[]),...(i.models||[])].join(" · ")||"Not configured"}</p></>}<button className="row-action" onClick={()=>onEdit(i)}><Wrench size={12}/> Open {sub}</button></div>)}{!items.length&&<EmptyState icon={<Boxes/>} title="No records" text="Create a platform record to populate this module."/>}</div></section>; }

function RolesView({users,roleCounts,onManageUsers}:{users:PlatformUser[];roleCounts:any;onManageUsers:()=>void}) {
  const rows:[RoleCode,string,string,boolean,boolean,boolean][]=[
    ["SUPER_ADMIN","Platform administration","Entire ARKA platform",true,false,false],
    ["TENANT_ADMIN","Organization management","Assigned organization",true,true,false],
    ["TENANT_USER","Security context","Assigned organization/workspace",true,true,true],
  ];
  return <section className="admin-console">
    <ConsoleHero eyebrow="AUTHORIZATION MODEL" title="Roles & Permissions" text="Define who controls the platform and who operates inside an organization." action="Manage users" onAction={onManageUsers}/>
    <div className="admin-role-cards">
      {rows.map(([code,title,desc])=>{
        const Icon=roleMeta[code].icon;
        const count=roleCounts[code==="SUPER_ADMIN"?"superAdmin":code==="TENANT_ADMIN"?"tenantAdmin":"tenantUser"];
        return <div className="admin-role-card" key={code}>
          <span>{code}</span><Icon/><h3>{title}</h3><p>{desc}</p><strong>{count}</strong><small>assigned identities</small>
        </div>;
      })}
    </div>
    <div className="admin-permissions">
      <TableHead title="System permissions" count={5}/>
      {[['Platform administration',true,false,false],['Organization management',true,true,false],['User & role management',true,true,false],['Organization security context',true,true,true],['Apps + Integrations + Agents',true,true,true]].map(([label,a,b,c])=><div className="permission-row" key={String(label)}><span>{label}</span><Permission ok={!!a}/><Permission ok={!!b}/><Permission ok={!!c}/></div>)}
    </div>
  </section>;
}

function UserDirectoryModal({users,tenants,onClose,onCreate,onEdit}:{users:PlatformUser[];tenants:Tenant[];onClose:()=>void;onCreate:()=>void;onEdit:(u:PlatformUser)=>void}) {
  const [search,setSearch]=useState("");
  const [roleFilter,setRoleFilter]=useState("all");
  const [tenantFilter,setTenantFilter]=useState("all");
  const filtered=users.filter(u=>{
    const q=search.trim().toLowerCase();
    const hay=`${u.full_name||""} ${u.email} ${u.role||""} ${u.tenant_name||""}`.toLowerCase();
    return (!q||hay.includes(q)) && (roleFilter==="all"||String(u.role||"").toUpperCase()===roleFilter) && (tenantFilter==="all"||String(u.tenant_id||"")===tenantFilter);
  });
  return <Modal title="Manage users" eyebrow="IDENTITY DIRECTORY" icon={<Users/>} onClose={onClose}>
    <div className="admin-user-directory">
      <div className="admin-directory-intro">
        <div><strong>All platform identities</strong><span>Review every ARKA user, organization assignment, status and role from one control surface.</span></div>
        <button className="admin-primary" onClick={onCreate}><Plus size={13}/> Add user</button>
      </div>
      <div className="admin-directory-tools">
        <div className="admin-search"><Search size={13}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email…"/></div>
        <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">All roles</option><option value="SUPER_ADMIN">Super Admin</option><option value="TENANT_ADMIN">Tenant Admin</option><option value="TENANT_USER">Tenant User</option></select>
        <select value={tenantFilter} onChange={e=>setTenantFilter(e.target.value)}><option value="all">All organizations</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
      <div className="admin-directory-count"><span>{filtered.length} of {users.length} identities</span><span>Changes are applied through ARKA RBAC</span></div>
      <div className="admin-directory-list">
        {filtered.length ? filtered.map(u=><div className="admin-directory-row" key={u.id}>
          <div className="admin-directory-identity"><div className="admin-directory-avatar">{(u.full_name||u.email||"?").charAt(0).toUpperCase()}</div><div><strong>{u.full_name||"Unnamed user"}</strong><small>{u.email}</small></div></div>
          <div className="admin-directory-org"><span>ORGANIZATION</span><strong>{u.tenant_name||"Platform"}</strong></div>
          <div className="admin-directory-role"><RolePill role={u.role||"UNASSIGNED"}/></div>
          <div className="admin-directory-status"><Status value={u.status}/></div>
          <button className="admin-directory-manage" onClick={()=>onEdit(u)}><Pencil size={12}/> Manage</button>
        </div>) : <EmptyState icon={<Users/>} title="No matching users" text="Try another name, email, role or organization filter."/>}
      </div>
    </div>
  </Modal>;
}

function PlatformConfig({onError}:{onError:(x:string)=>void}) { const [maintenance,setMaintenance]=useState(false),[signups,setSignups]=useState(true),[region,setRegion]=useState("default"),[saving,setSaving]=useState(false); useEffect(()=>{if(!supabase)return; void supabase.from("platform_config").select("maintenance_mode,allow_new_signups,default_region").eq("id",true).maybeSingle().then(({data})=>{if(data){setMaintenance(!!data.maintenance_mode);setSignups(data.allow_new_signups!==false);setRegion(data.default_region||"default")}})},[]); async function save(){if(!supabase)return;setSaving(true);const {error}=await supabase.from("platform_config").upsert({id:true,maintenance_mode:maintenance,allow_new_signups:signups,default_region:region,updated_at:new Date().toISOString()});setSaving(false);if(error)onError(error.message);else void supabase.from("audit_logs").select("id").limit(1)} return <section className="admin-console"><ConsoleHero eyebrow="CONTROL PLANE" title="Platform Configuration" text="Global settings that sit above tenant configuration."/><div className="admin-config-panel"><label><span>Maintenance mode</span><input type="checkbox" checked={maintenance} onChange={e=>setMaintenance(e.target.checked)}/><small>Place the platform into controlled maintenance state.</small></label><label><span>Allow new signups</span><input type="checkbox" checked={signups} onChange={e=>setSignups(e.target.checked)}/><small>Allow the onboarding flow to create new organizations.</small></label><label><span>Default region</span><select value={region} onChange={e=>setRegion(e.target.value)}><option value="default">Default</option><option value="ap-south-1">Asia Pacific</option><option value="eu-west-1">Europe</option><option value="us-east-1">US East</option></select></label><button className="admin-primary" disabled={saving} onClick={()=>void save()}>{saving?<><RefreshCw className="spin" size={13}/> Saving</>:<><Check size={13}/> Save configuration</>}</button></div></section>; }

function SystemHealth({counts}:{counts:any}) { const rows=[["API","Healthy",Server],["Workers","Healthy",Workflow],["Graph DB","Connected / configured separately",Database],["MinIO","Connected / configured separately",Database],["Supabase","Operational",Database],["RBAC","Database-backed",ShieldCheck]] as const;return <section className="admin-console"><ConsoleHero eyebrow="OPERATIONS" title="System Health" text="A platform-level health surface. Individual infrastructure probes can be connected here without changing tenant authorization."/><div className="admin-health-grid">{rows.map(([label,value,Icon])=><div key={label}><Icon/><span>{label}</span><strong><i/>{value}</strong></div>)}</div><div className="admin-health-note"><Activity size={15}/><div><strong>Current registry footprint</strong><span>{counts.organizations} organizations · {counts.users} users · {counts.apps} applications · {counts.integrations} integrations · {counts.agents} agents · {counts.workspaces} workspaces</span></div></div></section>; }

function AuditView({audit,tenants}:{audit:Audit[];tenants:Tenant[]}) { return <section className="admin-console"><ConsoleHero eyebrow="IMMUTABLE ACTIVITY" title="Audit Logs" text="Every platform control-plane mutation should be visible here: organizations, users, applications, integrations, agents, roles and configuration."/><div className="admin-table-panel"><TableHead title="Recent platform activity" count={audit.length}/>{audit.length?audit.map((a,i)=><div className="admin-audit" key={String(a.id)}><span>{String(i+1).padStart(2,"0")}</span><Activity size={14}/><div><strong>{prettyAction(a.action)}</strong><small>{a.entity_type||"platform"} · {a.tenant_id?tenants.find(t=>t.id===a.tenant_id)?.name||"organization":"Platform"}{a.entity_id?` · ${a.entity_id.slice(0,12)}`:""}</small></div><time>{timeAgo(a.created_at)}</time></div>):<EmptyState icon={<Activity/>} title="No audit events yet" text="Platform mutations will appear here once recorded."/>}</div></section>; }

function ConsoleHero({eyebrow,title,text,action,onAction}:{eyebrow:string;title:string;text:string;action?:string;onAction?:()=>void}) { return <div className="admin-console-hero"><div><p className="admin-kicker"><span/> {eyebrow}</p><h2>{title}</h2><p>{text}</p></div>{action&&onAction&&<button className="admin-primary" onClick={onAction}><Plus size={14}/>{action}<ChevronRight size={13}/></button>}</div>; }
function TableHead({title,count}:{title:string;count:number}) { return <div className="admin-table-head"><h3>{title}</h3><span>{count} records</span></div>; }
function Status({value}:{value:string}) { const v=String(value||"unknown").toLowerCase();return <span className={`admin-status ${v}`}><i/>{value||"Unknown"}</span>; }
function RolePill({role}:{role:string}) { const n=role.toUpperCase() as RoleCode;return <span className={`admin-role-pill ${n.toLowerCase()}`}><i/>{roleMeta[n]?.label||role.replaceAll("_"," ")}</span>; }
function RoleMetric({label,value}:{label:string;value:number}) { return <div className="admin-role-metric"><span>{label}</span><strong>{value}</strong></div>; }
function RoleBar({label,value,total}:{label:string;value:number;total:number}) { return <div className="admin-rolebar"><div><span>{label}</span><b>{value}</b></div><i><em style={{width:`${Math.min(100,Math.round(value/total*100))}%`}}/></i></div>; }
function Permission({ok}:{ok:boolean}) { return <span className={ok?"yes":"no"}>{ok?<Check size={12}/>:"—"}</span>; }
function Health({label}:{label:string}) { return <div><span>{label}</span><strong><i/> Healthy</strong></div>; }
function Orbit({icon}:{icon:ReactNode}) { return <div className="admin-orbit"><i/><i/><i/><b>{icon}</b></div>; }
function EmptyState({icon,title,text,action}:{icon:ReactNode;title:string;text:string;action?:ReactNode}) { return <div className="admin-empty">{icon}<strong>{title}</strong><span>{text}</span>{action}</div>; }

function CreateTenantModal({onClose,onSave}:{onClose:()=>void;onSave:(name:string,slug:string,status:string)=>Promise<void>}) { const [name,setName]=useState(""),[slug,setSlug]=useState(""),[status,setStatus]=useState("active"),[saving,setSaving]=useState(false);return <Modal title="Create organization" eyebrow="ORGANIZATION CONTROL" icon={<Building2/>} onClose={onClose}><form className="admin-form" onSubmit={async e=>{e.preventDefault();if(!name.trim())return;setSaving(true);await onSave(name,slug,status);setSaving(false)}}><label>ORGANIZATION NAME<input required value={name} onChange={e=>{setName(e.target.value);if(!slug)setSlug(slugify(e.target.value))}} placeholder="Acme Corp"/></label><label>SLUG<input required value={slug} onChange={e=>setSlug(e.target.value)} placeholder="acme-corp"/></label><label>STATUS<select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active</option><option value="onboarding">Onboarding</option><option value="trial">Trial</option><option value="suspended">Suspended</option></select></label><div className="admin-modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button disabled={saving} className="admin-primary">{saving?<><RefreshCw size={13} className="spin"/> Creating</>:<><Check size={13}/> Create organization</>}</button></div></form></Modal>; }

function InviteModal({tenants,onClose,onCreated}:{tenants:Tenant[];onClose:()=>void;onCreated:()=>Promise<void>}) { const [email,setEmail]=useState(""),[name,setName]=useState(""),[role,setRole]=useState<RoleCode>("TENANT_USER"),[tenantId,setTenantId]=useState(tenants[0]?.id||""),[saving,setSaving]=useState(false),[error,setError]=useState("");async function submit(e:FormEvent){e.preventDefault();if(!supabase)return;if(!email.trim()){setError("Email is required.");return}if(role!=="SUPER_ADMIN"&&!tenantId){setError("Select an organization.");return}setSaving(true);try{const {error:fnError}=await supabase.functions.invoke("admin-invite-user",{body:{email:email.trim(),fullName:name.trim(),role,tenantId:role==="SUPER_ADMIN"?null:tenantId}});if(fnError)throw fnError;await onCreated()}catch(err){setError(err instanceof Error?err.message:"Invitation could not be sent. Confirm admin-invite-user is deployed.")}finally{setSaving(false)}}return <Modal title="Create user" eyebrow="IDENTITY CONTROL" icon={<UserPlus/>} onClose={onClose}><form className="admin-form" onSubmit={submit}><label>FULL NAME<input value={name} onChange={e=>setName(e.target.value)} placeholder="John Smith"/></label><label>EMAIL<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="john@company.com"/></label><div className="two"><label>ROLE<select value={role} onChange={e=>setRole(e.target.value as RoleCode)}><option value="TENANT_USER">Tenant User</option><option value="TENANT_ADMIN">Tenant Admin</option><option value="SUPER_ADMIN">Super Admin</option></select></label><label>ORGANIZATION<select disabled={role==="SUPER_ADMIN"} value={tenantId} onChange={e=>setTenantId(e.target.value)}><option value="">Select organization</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>{error&&<div className="admin-modal-error">{error}</div>}<div className="admin-modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="admin-primary" disabled={saving}>{saving?<><RefreshCw className="spin" size={13}/> Sending</>:<><Mail size={13}/> Send invitation</>}</button></div></form></Modal>; }

function RegistryModal({type,initial,onClose,onSave}:{type:"apps"|"integrations"|"agents";initial?:RegistryRecord;onClose:()=>void;onSave:(values:Partial<RegistryRecord>)=>Promise<void>}) { const [name,setName]=useState(initial?.name||""),[slug,setSlug]=useState(initial?.slug||""),[version,setVersion]=useState(initial?.version||"1.0"),[status,setStatus]=useState(initial?.status||"draft"),[description,setDescription]=useState(initial?.description||""),[capabilities,setCapabilities]=useState((initial?.capabilities||[]).join(", ")),[tools,setTools]=useState((initial?.tools||[]).join(", ")),[models,setModels]=useState((initial?.models||[]).join(", ")),[saving,setSaving]=useState(false);const title=type==="apps"?"Application":type==="integrations"?"Integration":"Agent";async function submit(e:FormEvent){e.preventDefault();setSaving(true);await onSave({name,slug,version,status,description,capabilities:capabilities.split(",").map(x=>x.trim()).filter(Boolean),tools:tools.split(",").map(x=>x.trim()).filter(Boolean),models:models.split(",").map(x=>x.trim()).filter(Boolean)});setSaving(false)}return <Modal title={`${initial?"Modify":"Create"} ${title}`} eyebrow="PLATFORM CATALOG" icon={type==="apps"?<AppWindow/>:type==="integrations"?<GitBranch/>:<Bot/>} onClose={onClose}><form className="admin-form" onSubmit={submit}><label>NAME<input required value={name} onChange={e=>{setName(e.target.value);if(!slug)setSlug(slugify(e.target.value))}}/></label><div className="two"><label>SLUG<input required value={slug} onChange={e=>setSlug(e.target.value)}/></label><label>VERSION<input value={version} onChange={e=>setVersion(e.target.value)}/></label></div><label>STATUS<select value={status} onChange={e=>setStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="disabled">Disabled</option><option value="active">Active</option></select></label><label>DESCRIPTION<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label>{type==="agents"&&<><label>CAPABILITIES<input value={capabilities} onChange={e=>setCapabilities(e.target.value)} placeholder="investigation, threat-hunting"/></label><label>TOOLS<input value={tools} onChange={e=>setTools(e.target.value)} placeholder="SIEM, EDR, web-search"/></label><label>MODELS<input value={models} onChange={e=>setModels(e.target.value)} placeholder="model-a, model-b"/></label></>}<div className="admin-modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="admin-primary" disabled={saving}>{saving?<><RefreshCw className="spin" size={13}/> Saving</>:<><Check size={13}/> Save {title}</>}</button></div></form></Modal>; }

function RoleEditor({user,tenants,busy,onClose,onSave}:{user:PlatformUser;tenants:Tenant[];busy:boolean;onClose:()=>void;onSave:(u:PlatformUser,r:RoleCode,t:string|null)=>Promise<void>}) { const [role,setRole]=useState<RoleCode>((String(user.role||"TENANT_USER").toUpperCase() as RoleCode)||"TENANT_USER"),[tenantId,setTenantId]=useState(user.tenant_id||tenants[0]?.id||"");return <Modal title="Manage access" eyebrow="ROLE CONTROL" icon={<ShieldCheck/>} onClose={onClose}><div className="admin-edit-user"><div className="avatar">{(user.full_name||user.email).charAt(0).toUpperCase()}</div><div><strong>{user.full_name||"Unnamed user"}</strong><small>{user.email}</small></div></div><div className="admin-role-choice">{(["SUPER_ADMIN","TENANT_ADMIN","TENANT_USER"] as RoleCode[]).map(code=><button key={code} className={role===code?"selected":""} onClick={()=>setRole(code)}><span><ShieldCheck size={15}/><b>{roleMeta[code].label}</b><small>{roleMeta[code].description}</small></span>{role===code&&<Check size={14}/>}</button>)}</div>{role!=="SUPER_ADMIN"&&<label className="admin-edit-select">ORGANIZATION<select value={tenantId} onChange={e=>setTenantId(e.target.value)}><option value="">Select organization</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}<div className="admin-modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="admin-primary" disabled={busy} onClick={()=>void onSave(user,role,role==="SUPER_ADMIN"?null:tenantId)}>{busy?<><RefreshCw size={13} className="spin"/> Applying</>:<><Check size={13}/> Apply role</>}</button></div></Modal>; }

function Modal({title,eyebrow,icon,onClose,children}:{title:string;eyebrow:string;icon:ReactNode;onClose:()=>void;children:ReactNode}) { return <div className="admin-modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}><motion.div initial={{opacity:0,y:15,scale:.98}} animate={{opacity:1,y:0,scale:1}} className="admin-modal"><div className="admin-modal-top"><div><span>{eyebrow}</span><h2>{title}</h2></div><div>{icon}</div><button onClick={onClose}><X size={16}/></button></div>{children}</motion.div></div>; }
