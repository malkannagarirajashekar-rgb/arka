import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, AppWindow, Check, ChevronRight, Database, GitBranch, LogOut,
  Menu, RefreshCw, Search, Settings, ShieldCheck, UserPlus, UserRound, Users,
  X, Mail, Building2, KeyRound, Pencil, Crown, UserCog
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAccessContext } from "../lib/access";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";

type RoleCode = "SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_USER";
type Role = "super_admin" | "tenant_admin" | "tenant_user";
type Tenant = { id: string; name: string; slug: string; status: string; created_at: string };
type PlatformUser = {
  id: string; email: string; full_name: string | null; role: RoleCode | string | null;
  tenant_id: string | null; tenant_name?: string | null; status: string; is_platform_user?: boolean;
};
type AppRecord = { id: string; tenant_id: string | null; name: string; slug: string; status: string; created_at: string };
type Audit = { id: number | string; action: string; entity_type: string | null; entity_id: string | null; tenant_id: string | null; created_at: string; metadata: Record<string, unknown> | null };

const nav = [
  ["Overview", Activity], ["Tenants", Database], ["Users", UserRound], ["Apps", AppWindow],
  ["Roles & Permissions", ShieldCheck], ["Audit Logs", Activity], ["Integrations", GitBranch], ["Settings", Settings],
] as const;

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const roleMeta: Record<RoleCode, { label: string; description: string; icon: typeof ShieldCheck }> = {
  SUPER_ADMIN: { label: "Super Admin", description: "Platform-wide control across every organization.", icon: Crown },
  TENANT_ADMIN: { label: "Tenant Admin", description: "Full administration inside one organization.", icon: UserCog },
  TENANT_USER: { label: "Tenant User", description: "Scoped access inside an assigned organization.", icon: UserRound },
};

export default function Admin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [active, setActive] = useState("Overview");
  const [sidebar, setSidebar] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [dataError, setDataError] = useState("");
  const [actionError, setActionError] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [counts, setCounts] = useState({ tenants: 0, users: 0, apps: 0, activeTenants: 0 });
  const [query, setQuery] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const loadLiveData = useCallback(async () => {
    if (!supabase) return;
    setLoadingData(true); setDataError("");
    try {
      const [tenantRes, userRes, membershipRes, appRes, auditRes] = await Promise.all([
        supabase.from("tenants").select("id,name,slug,status,created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,email,full_name,role,tenant_id,status,is_platform_user,created_at").order("created_at", { ascending: false }),
        supabase.from("user_tenant_memberships").select("user_id,tenant_id,status,created_at,roles(code,name,scope)").eq("status", "active"),
        supabase.from("apps").select("id,tenant_id,name,slug,status,created_at").order("created_at", { ascending: false }),
        supabase.from("audit_logs").select("id,action,entity_type,entity_id,tenant_id,created_at,metadata").order("created_at", { ascending: false }).limit(8),
      ]);
      const firstError = tenantRes.error || userRes.error || membershipRes.error || appRes.error || auditRes.error;
      if (firstError) throw firstError;
      const tenantRows = (tenantRes.data ?? []) as Tenant[];
      const membershipRows = (membershipRes.data ?? []) as any[];
      const membershipByUser = new Map<string, any[]>();
      membershipRows.forEach(m => membershipByUser.set(m.user_id, [...(membershipByUser.get(m.user_id) ?? []), m]));
      const userRows = ((userRes.data ?? []) as PlatformUser[]).map(u => {
        const memberships = membershipByUser.get(u.id) ?? [];
        const primary = memberships.sort((a, b) => String(a.roles?.code).includes("ADMIN") ? -1 : String(b.roles?.code).includes("ADMIN") ? 1 : 0)[0];
        return {
          ...u,
          role: u.is_platform_user ? "SUPER_ADMIN" : (primary?.roles?.code ?? u.role),
          tenant_id: u.is_platform_user ? null : (primary?.tenant_id ?? u.tenant_id),
          tenant_name: u.is_platform_user ? "Platform" : tenantRows.find(t => t.id === (primary?.tenant_id ?? u.tenant_id))?.name ?? null,
        };
      });
      const appRows = (appRes.data ?? []) as AppRecord[];
      const auditRows = (auditRes.data ?? []) as Audit[];
      setTenants(tenantRows); setUsers(userRows); setApps(appRows); setAudit(auditRows);
      setCounts({ tenants: tenantRows.length, users: userRows.length, apps: appRows.length, activeTenants: tenantRows.filter(t => String(t.status).toLowerCase() === "active").length });
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Live platform data could not be loaded.");
    } finally { setLoadingData(false); }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      if (!supabaseConfigured || !supabase) { navigate("/login", { replace: true }); return; }
      try {
        const access = await getAccessContext();
        if (!access) { if (mounted) { setChecking(false); setAccessError("Your authentication session could not be verified."); } return; }
        if (access.role !== "SUPER_ADMIN") { navigate(access.role === "TENANT_ADMIN" ? "/tenant" : "/app", { replace: true }); return; }
        if (mounted) { setEmail(access.email); setFullName(access.fullName); setRole("super_admin"); setChecking(false); }
        await loadLiveData();
      } catch (e) {
        if (mounted) { setChecking(false); setAccessError(e instanceof Error ? e.message : "Unable to verify access."); }
      }
    }
    loadUser();
    const { data: { subscription } } = supabaseConfigured && supabase ? supabase.auth.onAuthStateChange((_event, session) => { if (!session) navigate("/login", { replace: true }); }) : { subscription: null };
    return () => { mounted = false; subscription?.unsubscribe(); };
  }, [navigate, loadLiveData]);

  async function logout() { if (supabase) await supabase.auth.signOut(); navigate("/login", { replace: true }); }

  async function assignRole(user: PlatformUser, nextRole: RoleCode, tenantId: string | null) {
    if (!supabase || busyUser) return;
    if (nextRole !== "SUPER_ADMIN" && !tenantId) { setActionError("A tenant is required for Tenant Admin and Tenant User roles."); return; }
    setBusyUser(user.id); setActionError("");
    try {
      const { error } = await supabase.rpc("admin_set_user_role", { p_user_id: user.id, p_role_code: nextRole, p_tenant_id: tenantId });
      if (error) throw error;
      setEditingUser(null);
      await loadLiveData();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Role assignment failed.");
    } finally { setBusyUser(null); }
  }

  // Keep every hook above the conditional render branches.  The previous V48 build
  // called useMemo only after `checking` became false, which changes the hook
  // order between the loading render and the loaded render and makes React throw
  // before the Admin console can paint.
  const roleCounts = useMemo(() => ({
    super: users.filter(u => u.role === "SUPER_ADMIN").length,
    admin: users.filter(u => u.role === "TENANT_ADMIN").length,
    user: users.filter(u => u.role === "TENANT_USER").length,
    pending: users.filter(u => String(u.status).toLowerCase() === "pending").length,
  }), [users]);

  if (checking) return <div className="auth-loading"><div className="loading-mark">◈</div><p>Verifying secure access…</p></div>;
  if (accessError) return <div className="auth-loading"><Brand /><div className="placeholder-card access-error-card"><ShieldCheck size={28} /><p className="eyebrow"><span /> ACCESS VERIFICATION FAILED</p><h1>We couldn't verify your access.</h1><p>{accessError}</p><div className="error-actions"><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button><button className="button button-ghost" onClick={logout}>Sign out</button></div></div></div>;
  if (!role) return null;

  const filteredTenants = tenants.filter(t => `${t.name} ${t.slug} ${t.status}`.toLowerCase().includes(query.toLowerCase()));
  const tenantName = (id: string | null) => id ? tenants.find(t => t.id === id)?.name ?? id.slice(0, 8) : "Platform";
  const filteredUsers = users.filter(u => `${u.email} ${u.full_name ?? ""} ${u.role ?? ""} ${u.tenant_name ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const filteredApps = apps.filter(a => `${a.name} ${a.slug} ${a.status}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="admin-v42">
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <div className="admin-brand"><Brand /><span className="admin-live-dot"><i /> LIVE</span></div>
        <div className="role-badge"><ShieldCheck size={13} /><span>SUPER ADMIN / PLATFORM</span></div>
        <div className="sidebar-nav">{nav.map(([label, Icon], i) => <button key={label} className={active === label ? "active" : ""} onClick={() => { setActive(label); setQuery(""); setActionError(""); setSidebar(false); }}><Icon size={16} />{label}{i === 0 && <span className="nav-arrow"><ChevronRight size={13} /></span>}</button>)}</div>
        <button className="signout" onClick={logout}><LogOut size={15} /> Sign out</button>
      </aside>
      {sidebar && <button className="mobile-backdrop" onClick={() => setSidebar(false)} aria-label="Close menu" />}
      <main className="admin-main">
        <header className="admin-header admin-header-v34 admin-command-header admin-header-v40">
          <button className="mobile-menu" onClick={() => setSidebar(v => !v)} aria-label="Open navigation">{sidebar ? <X /> : <Menu />}</button>
          <div><p className="eyebrow"><span /> ARKA / PLATFORM CONTROL</p><h1>{active}</h1></div>
          <div className="admin-user"><span className="online" /><div className="admin-user-text"><strong>{fullName || "Super Admin"}</strong><small>{email}</small></div><ThemeToggle /></div>
        </header>
        <div className="admin-toolbar"><div className="admin-context"><span className="pulse" /> DATABASE-BACKED VIEW <b>{loadingData ? "SYNCING" : "LIVE"}</b></div><div className="admin-tools"><div className="admin-search"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${active.toLowerCase()}…`} /></div><button className="admin-refresh" onClick={() => void loadLiveData()} disabled={loadingData}><RefreshCw size={14} className={loadingData ? "spin" : ""} /> Refresh</button></div></div>
        {dataError && <div className="admin-data-error"><ShieldCheck size={15} /><span>{dataError}</span></div>}
        {actionError && <div className="admin-action-error"><ShieldCheck size={15} /><span>{actionError}</span><button onClick={() => setActionError("")}><X size={13}/></button></div>}

        <div className="admin-content admin-content-v34 admin-command-content">
          {active === "Overview" && <>
            <section className="v41-hero">
              <div className="v41-hero-copy"><div className="v41-kicker"><span className="v41-live-dot" /> PLATFORM COMMAND DECK <b>LIVE</b></div><h2>See every organization.<br /><em>Control every boundary.</em></h2><p>ARKA gives platform operators one operational view across tenants, identities, applications and security events.</p><div className="v41-hero-actions"><button className="v41-primary" onClick={() => setActive("Tenants")}>Open tenant registry <ChevronRight size={15}/></button><button className="v41-secondary" onClick={() => setActive("Audit Logs")}>Inspect activity <Activity size={14}/></button></div></div>
              <div className="v41-radar" aria-hidden="true"><div className="v41-radar-grid" /><div className="v41-radar-ring r1"/><div className="v41-radar-ring r2"/><div className="v41-radar-ring r3"/><div className="v41-radar-core"><ShieldCheck size={25}/><small>ARKA</small></div><i className="v41-signal s1"/><i className="v41-signal s2"/><i className="v41-signal s3"/></div>
            </section>
            <section className="v41-kpis"><div className="v41-kpi"><span>01 / TENANTS</span><strong>{counts.tenants}</strong><small>{counts.activeTenants} active organizations</small><i/></div><div className="v41-kpi"><span>02 / IDENTITIES</span><strong>{counts.users}</strong><small>{roleCounts.pending} pending identities</small><i/></div><div className="v41-kpi"><span>03 / APPLICATIONS</span><strong>{counts.apps}</strong><small>connected applications</small><i/></div><div className="v41-kpi live"><span>04 / CONTROL PLANE</span><strong>LIVE</strong><small>Supabase operational</small><i/></div></section>
            <section className="v41-lower-grid"><div className="v41-activity"><div className="v41-section-head"><div><span>ACTIVITY STREAM</span><h3>What changed</h3></div><button onClick={() => setActive("Audit Logs")}>All events <ChevronRight size={13}/></button></div>{audit.length ? audit.slice(0,5).map((a,index)=><div className="v41-event" key={String(a.id)}><div className="v41-event-index">0{index+1}</div><div className="v41-event-line"><i/><span/></div><div className="v41-event-body"><b>{a.action.replaceAll("_"," ")}</b><small>{a.entity_type || "platform"} · {tenantName(a.tenant_id)}</small></div><time>{timeAgo(a.created_at)}</time></div>) : <div className="v41-empty">No platform events yet. New activity will appear here.</div>}</div><div className="v41-control"><div className="v41-section-head"><div><span>CONTROL SURFACE</span><h3>Platform state</h3></div><span className="v41-state">NOMINAL</span></div><div className="v41-state-map"><div className="v41-state-node root"><ShieldCheck size={18}/><b>ARKA</b><small>control plane</small></div><div className="v41-state-link l1"/><div className="v41-state-link l2"/><div className="v41-state-link l3"/><div className="v41-state-node n1"><Database size={14}/><b>Tenants</b><small>{counts.tenants} records</small></div><div className="v41-state-node n2"><Users size={14}/><b>Identities</b><small>{counts.users} records</small></div><div className="v41-state-node n3"><AppWindow size={14}/><b>Apps</b><small>{counts.apps} records</small></div></div><div className="v41-control-foot"><span><i/> Authenticated</span><span><i/> RLS enforced</span><span><i/> Live database</span></div></div></section>
          </>}

          {active === "Tenants" && <section className="tenant-registry-v42"><div className="tenant-registry-head"><div><p className="tenant-eyebrow"><span/> LIVE TENANT REGISTRY</p><h2>Organizations</h2><p>Every organization connected to the ARKA control plane, sourced directly from Supabase.</p></div><div className="tenant-registry-actions"><button className="tenant-action" onClick={() => void loadLiveData()} disabled={loadingData}><RefreshCw size={14} className={loadingData ? "spin" : ""}/> {loadingData ? "Syncing" : "Sync registry"}</button></div></div><div className="tenant-registry-metrics"><div><span>TOTAL</span><strong>{counts.tenants}</strong><small>organizations</small></div><div><span>ACTIVE</span><strong>{counts.activeTenants}</strong><small>operational</small></div><div><span>INACTIVE</span><strong>{Math.max(0,counts.tenants-counts.activeTenants)}</strong><small>not active</small></div><div><span>VIEW</span><strong>{filteredTenants.length}</strong><small>matching records</small></div></div><div className="tenant-registry-card"><div className="tenant-table-head"><div><span>ORGANIZATION DIRECTORY</span><h3>Tenant records</h3></div><b>{filteredTenants.length} visible</b></div><div className="tenant-table"><div className="tenant-row tenant-row-head"><span>Organization</span><span>Slug</span><span>Status</span><span>Created</span></div>{filteredTenants.length ? filteredTenants.map(t=><div className="tenant-row" key={t.id}><span className="tenant-name"><i/><div><strong>{t.name || "Unnamed organization"}</strong><small>{t.id}</small></div></span><span className="tenant-slug">{t.slug || "—"}</span><span><Status value={t.status}/></span><span className="tenant-created">{new Date(t.created_at).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"})}</span></div>) : <div className="tenant-empty"><Database size={22}/><strong>No organizations yet</strong><span>Complete tenant onboarding and the organization will appear here automatically.</span></div>}</div></div></section>}

          {active === "Users" && <UsersConsole users={filteredUsers} tenants={tenants} roleCounts={roleCounts} onInvite={() => { setActionError(""); setShowInvite(true); }} onEdit={setEditingUser} busyUser={busyUser}/>} 
          {active === "Apps" && <section className="admin-panel admin-panel-v34 admin-table-panel"><TableHeader eyebrow="APPLICATION REGISTRY" title="Connected applications" count={filteredApps.length}/><div className="live-table"><div className="table-row table-head"><span>Application</span><span>Tenant</span><span>Status</span><span>Created</span></div>{filteredApps.length ? filteredApps.map(a=><div className="table-row" key={a.id}><span className="entity-cell"><b>{a.name || "Unnamed app"}</b><small>{a.slug}</small></span><span>{tenantName(a.tenant_id)}</span><span><Status value={a.status}/></span><span>{new Date(a.created_at).toLocaleDateString()}</span></div>) : <Empty title="No applications found" text="Connected applications will appear here."/>}</div></section>}
          {active === "Audit Logs" && <section className="admin-panel admin-panel-v34"><TableHeader eyebrow="IMMUTABLE ACTIVITY" title="Audit log" count={audit.length}/><div className="audit-list">{audit.length ? audit.map(a=><ActivityRow key={String(a.id)} audit={a} tenantName={tenantName}/>) : <Empty title="No audit events yet" text="Platform actions will be recorded here."/>}</div></section>}
          {active === "Roles & Permissions" && <RolesConsole users={users} roleCounts={roleCounts} onEdit={setEditingUser}/>} 
          {active === "Integrations" && <Placeholder title="Integrations" text="Platform integrations will connect here to ARKA's application and security context."/>}
          {active === "Settings" && <Placeholder title="Settings" text="Platform configuration, security policy and system preferences."/>}
        </div>
      </main>

      {showInvite && <InviteModal tenants={tenants} onClose={() => setShowInvite(false)} onCreated={async () => { setShowInvite(false); await loadLiveData(); }} />}
      {editingUser && <RoleEditor user={editingUser} tenants={tenants} busy={busyUser === editingUser.id} onClose={() => setEditingUser(null)} onSave={assignRole}/>} 
    </div>
  );
}

function UsersConsole({users,tenants,roleCounts,onInvite,onEdit,busyUser}:{users:PlatformUser[];tenants:Tenant[];roleCounts:{super:number;admin:number;user:number;pending:number};onInvite:()=>void;onEdit:(u:PlatformUser)=>void;busyUser:string|null}) {
  return <section className="admin-users-console">
    <div className="users-command-head"><div><p className="eyebrow"><span/> IDENTITY COMMAND</p><h2>People, access & <em>roles.</em></h2><p>Invite identities, assign an organization and control their authoritative ARKA role from one platform surface.</p></div><button className="users-add-button" onClick={onInvite}><UserPlus size={16}/> Add user <ChevronRight size={14}/></button></div>
    <div className="user-role-strip"><RoleMini icon={<Crown/>} label="Super Admin" value={roleCounts.super} meta="platform identities"/><RoleMini icon={<UserCog/>} label="Tenant Admin" value={roleCounts.admin} meta="organization operators"/><RoleMini icon={<UserRound/>} label="Tenant User" value={roleCounts.user} meta="scoped identities"/><RoleMini icon={<Activity/>} label="Pending" value={roleCounts.pending} meta="awaiting activation"/></div>
    <div className="users-directory"><div className="directory-head"><div><span>LIVE IDENTITY DIRECTORY</span><h3>Platform users</h3></div><b>{users.length} identities</b></div>{users.length ? users.map(u=><motion.div layout key={u.id} className="user-record"><div className="user-avatar">{(u.full_name || u.email || "?").trim().charAt(0).toUpperCase()}</div><div className="user-identity"><strong>{u.full_name || "Unnamed user"}</strong><small>{u.email}</small><span>{u.id}</span></div><div className="user-role-cell"><RolePill role={String(u.role || "UNASSIGNED")}/>{u.tenant_name && <small><Building2 size={10}/> {u.tenant_name}</small>}</div><Status value={u.status}/><button className="user-edit-button" onClick={()=>onEdit(u)} disabled={busyUser===u.id}><Pencil size={14}/> {busyUser===u.id ? "Saving" : "Manage"}</button></motion.div>) : <Empty title="No users found" text="Use Add user to invite the first identity."/>}</div>
  </section>;
}

function RolesConsole({users,roleCounts,onEdit}:{users:PlatformUser[];roleCounts:{super:number;admin:number;user:number;pending:number};onEdit:(u:PlatformUser)=>void}) {
  const cards:[RoleCode,string,string,number][] = [["SUPER_ADMIN","Super Admin","Platform-wide control. No tenant membership required.",roleCounts.super],["TENANT_ADMIN","Tenant Admin","Organization administration, users and first-login onboarding.",roleCounts.admin],["TENANT_USER","Tenant User","Scoped access inside an assigned organization.",roleCounts.user]];
  return <section className="roles-console"><div className="roles-command-head"><div><p className="eyebrow"><span/> AUTHORIZATION MODEL</p><h2>Roles are <em>control surfaces.</em></h2><p>ARKA keeps three system roles explicit. Super Admin controls assignments; tenant roles stay scoped to an organization.</p></div><div className="roles-count-orbit"><ShieldCheck size={22}/><strong>{users.length}</strong><small>identities</small></div></div><div className="role-command-grid">{cards.map(([code,title,text,count])=>{const Icon=roleMeta[code].icon;return <div className="role-command-card" key={code}><div className="role-command-top"><span>{code}</span><Icon size={18}/></div><h3>{title}</h3><p>{text}</p><strong>{count}</strong><small>assigned identities</small></div>})}</div><div className="permission-surface"><div className="directory-head"><div><span>CAPABILITY MATRIX</span><h3>System permissions</h3></div><b>RBAC / DATABASE AUTHORITY</b></div><div className="permission-grid"><div className="permission-header"><span>CAPABILITY</span><b>SUPER ADMIN</b><b>TENANT ADMIN</b><b>TENANT USER</b></div><PermissionRow label="Platform administration" sa={true} tenant={false} user={false}/><PermissionRow label="Tenant & organization management" sa={true} tenant={true} user={false}/><PermissionRow label="User & role management" sa={true} tenant={true} user={false}/><PermissionRow label="Organization security context" sa={true} tenant={true} user={true}/><PermissionRow label="Connected applications" sa={true} tenant={true} user={true}/></div></div></section>;
}

function PermissionRow({label,sa,tenant,user}:{label:string;sa:boolean;tenant:boolean;user:boolean}){return <div className="permission-row"><span>{label}</span><Permission state={sa}/><Permission state={tenant}/><Permission state={user}/></div>}
function Permission({state}:{state:boolean}){return <span className={state?"permission-yes":"permission-no"}>{state?<Check size={13}/>:"—"}</span>}
function RolePill({role}:{role:string}){const normalized=role.toUpperCase() as RoleCode;return <span className={`admin-role-pill ${normalized.toLowerCase()}`}><i/>{roleMeta[normalized]?.label || role.replaceAll("_"," ")}</span>}
function RoleMini({icon,label,value,meta}:{icon:ReactNode;label:string;value:number;meta:string}){return <div className="role-mini"><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div>}

function InviteModal({tenants,onClose,onCreated}:{tenants:Tenant[];onClose:()=>void;onCreated:()=>Promise<void>}) {
  const [email,setEmail]=useState(""); const [name,setName]=useState(""); const [role,setRole]=useState<RoleCode>("TENANT_USER"); const [tenantId,setTenantId]=useState(tenants[0]?.id ?? ""); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  async function submit(e:React.FormEvent){e.preventDefault();if(!supabase||saving)return;if(!email.trim())return setError("Email is required.");if(role!=="SUPER_ADMIN"&&!tenantId)return setError("Select a tenant for this role.");setSaving(true);setError("");try{const {error:fnError}=await supabase.functions.invoke("admin-invite-user",{body:{email:email.trim(),fullName:name.trim(),role,tenantId:role==="SUPER_ADMIN"?null:tenantId}});if(fnError)throw fnError;await onCreated();}catch(e){setError(e instanceof Error?e.message:"Invitation could not be sent.");}finally{setSaving(false)}}
  return <ModalShell title="Add user" eyebrow="NEW IDENTITY" icon={<UserPlus/>} onClose={onClose}><form className="admin-form" onSubmit={submit}><div className="invite-intro"><div><strong>Invite a person into ARKA.</strong><span>The account receives the selected role after they accept the invitation.</span></div><KeyRound size={20}/></div><label>FULL NAME<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Priya Sharma"/></label><label>EMAIL ADDRESS<div className="input-icon"><Mail size={14}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="person@company.com"/></div></label><div className="form-grid"><label>ROLE<select value={role} onChange={e=>setRole(e.target.value as RoleCode)}><option value="TENANT_USER">Tenant User</option><option value="TENANT_ADMIN">Tenant Admin</option><option value="SUPER_ADMIN">Super Admin</option></select></label><label className={role==="SUPER_ADMIN"?"is-disabled":""}>ORGANIZATION<select disabled={role==="SUPER_ADMIN"} value={tenantId} onChange={e=>setTenantId(e.target.value)}><option value="">Select organization</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>{role==="SUPER_ADMIN"&&<div className="form-note"><Crown size={14}/> Super Admin is platform-wide and does not require an organization.</div>}{error&&<div className="modal-error">{error}</div>}<div className="modal-actions"><button type="button" className="modal-secondary" onClick={onClose}>Cancel</button><button className="modal-primary" disabled={saving}>{saving?<><RefreshCw size={14} className="spin"/> Sending</>:<><Mail size={14}/> Send invitation</>}</button></div></form></ModalShell>;
}

function RoleEditor({user,tenants,busy,onClose,onSave}:{user:PlatformUser;tenants:Tenant[];busy:boolean;onClose:()=>void;onSave:(u:PlatformUser,r:RoleCode,t:string|null)=>Promise<void>}){
  const initial=(String(user.role||"TENANT_USER").toUpperCase() as RoleCode);const [role,setRole]=useState<RoleCode>(initial);const [tenantId,setTenantId]=useState(user.tenant_id ?? tenants[0]?.id ?? "");
  return <ModalShell title="Manage access" eyebrow="ROLE CONTROL" icon={<ShieldCheck/>} onClose={onClose}><div className="edit-user-banner"><div className="user-avatar large">{(user.full_name||user.email||"?").charAt(0).toUpperCase()}</div><div><strong>{user.full_name||"Unnamed user"}</strong><span>{user.email}</span></div></div><div className="role-choice-list">{(["SUPER_ADMIN","TENANT_ADMIN","TENANT_USER"] as RoleCode[]).map(code=>{const Icon=roleMeta[code].icon;return <button key={code} className={role===code?"selected":""} onClick={()=>setRole(code)}><div><Icon size={17}/><span><strong>{roleMeta[code].label}</strong><small>{roleMeta[code].description}</small></span></div>{role===code&&<Check size={16}/>}</button>})}</div>{role!=="SUPER_ADMIN"&&<label className="edit-tenant-label">ORGANIZATION<select value={tenantId} onChange={e=>setTenantId(e.target.value)}>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}{role==="SUPER_ADMIN"&&<div className="form-note"><Crown size={14}/> This grants platform-wide administrative control.</div>}<div className="modal-actions"><button className="modal-secondary" onClick={onClose}>Cancel</button><button className="modal-primary" disabled={busy} onClick={()=>void onSave(user,role,role==="SUPER_ADMIN"?null:tenantId)}>{busy?<><RefreshCw size={14} className="spin"/> Applying</>:<><Check size={14}/> Apply role</>}</button></div></ModalShell>;
}

function ModalShell({title,eyebrow,icon,onClose,children}:{title:string;eyebrow:string;icon:ReactNode;onClose:()=>void;children:ReactNode}){return <div className="admin-modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}><motion.div initial={{opacity:0,y:18,scale:.98}} animate={{opacity:1,y:0,scale:1}} className="admin-modal"><div className="modal-top"><div><span>{eyebrow}</span><h2>{title}</h2></div><div className="modal-icon">{icon}</div><button onClick={onClose} aria-label="Close"><X size={17}/></button></div>{children}</motion.div></div>}

function TableHeader({eyebrow,title,count}:{eyebrow:string;title:string;count:number}){return <div className="panel-title"><div><p className="eyebrow"><span/> {eyebrow}</p><h2>{title}</h2></div><span className="table-count">{count} records</span></div>}
function Status({value}:{value:string}){const normalized=String(value||"unknown").toLowerCase();return <span className={`status-pill ${normalized}`}><i/>{value||"Unknown"}</span>}
function ActivityRow({audit,tenantName}:{audit:Audit;tenantName:(id:string|null)=>string}){return <div className="activity-row activity-row-v34"><span className="activity-symbol">◈</span><div><b>{audit.action.replaceAll("_"," ")}</b><small>{audit.entity_type||"platform"}{audit.entity_id?` · ${String(audit.entity_id).slice(0,8)}`:""} · {tenantName(audit.tenant_id)}</small></div><time>{timeAgo(audit.created_at)}</time></div>}
function Empty({title,text}:{title:string;text:string}){return <div className="admin-empty"><Database size={20}/><strong>{title}</strong><span>{text}</span></div>}
function Placeholder({title,text}:{title:string;text:string}){return <section className="admin-panel admin-panel-v34 admin-placeholder-v34"><p className="eyebrow"><span/> PLATFORM MODULE</p><h2>{title}</h2><p>{text}</p></section>}
