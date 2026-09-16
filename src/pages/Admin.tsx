import { useCallback, useEffect, useState } from "react";
import {
  Activity, AppWindow, ChevronRight, Database, GitBranch, LogOut,
  Menu, RefreshCw, Search, Settings, ShieldCheck, UserRound, Users, X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAccessContext } from "../lib/access";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";

type Role = "super_admin" | "tenant_admin" | "tenant_user";
type Tenant = { id: string; name: string; slug: string; status: string; created_at: string };
type PlatformUser = { id: string; email: string; full_name: string | null; role: string | null; tenant_id: string | null; status: string };
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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [counts, setCounts] = useState({ tenants: 0, users: 0, apps: 0, activeTenants: 0 });
  const [query, setQuery] = useState("");

  const loadLiveData = useCallback(async () => {
    if (!supabase) return;
    setLoadingData(true); setDataError("");
    try {
      const [tenantRes, userRes, appRes, auditRes] = await Promise.all([
        supabase.from("tenants").select("id,name,slug,status,created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,email,full_name,role,tenant_id,status").order("created_at", { ascending: false }),
        supabase.from("apps").select("id,tenant_id,name,slug,status,created_at").order("created_at", { ascending: false }),
        supabase.from("audit_logs").select("id,action,entity_type,entity_id,tenant_id,created_at,metadata").order("created_at", { ascending: false }).limit(8),
      ]);
      const firstError = tenantRes.error || userRes.error || appRes.error || auditRes.error;
      if (firstError) throw firstError;
      const tenantRows = (tenantRes.data ?? []) as Tenant[];
      const userRows = (userRes.data ?? []) as PlatformUser[];
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

  if (checking) return <div className="auth-loading"><div className="loading-mark">◈</div><p>Verifying secure access…</p></div>;
  if (accessError) return <div className="auth-loading"><Brand /><div className="placeholder-card access-error-card"><ShieldCheck size={28} /><p className="eyebrow"><span /> ACCESS VERIFICATION FAILED</p><h1>We couldn't verify your access.</h1><p>{accessError}</p><div className="error-actions"><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button><button className="button button-ghost" onClick={logout}>Sign out</button></div></div></div>;
  if (!role) return null;

  const filteredTenants = tenants.filter(t => `${t.name} ${t.slug} ${t.status}`.toLowerCase().includes(query.toLowerCase()));
  const tenantName = (id: string | null) => id ? tenants.find(t => t.id === id)?.name ?? id.slice(0, 8) : "Platform";
  const filteredUsers = users.filter(u => `${u.email} ${u.full_name ?? ""} ${u.role ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const filteredApps = apps.filter(a => `${a.name} ${a.slug} ${a.status}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="admin-v42">
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <div className="admin-brand"><Brand /><span className="admin-live-dot"><i /> LIVE</span></div>
        <div className="role-badge"><ShieldCheck size={13} /><span>SUPER ADMIN / PLATFORM</span></div>
        <div className="sidebar-nav">{nav.map(([label, Icon], i) => <button key={label} className={active === label ? "active" : ""} onClick={() => { setActive(label); setQuery(""); setSidebar(false); }}><Icon size={16} />{label}{i === 0 && <span className="nav-arrow"><ChevronRight size={13} /></span>}</button>)}</div>
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

        <div className="admin-content admin-content-v34 admin-command-content">
          {active === "Overview" && <>
            <section className="v41-hero">
              <div className="v41-hero-copy">
                <div className="v41-kicker"><span className="v41-live-dot" /> PLATFORM COMMAND DECK <b>LIVE</b></div>
                <h2>See every organization.<br /><em>Control every boundary.</em></h2>
                <p>ARKA gives platform operators one operational view across tenants, identities, applications and security events.</p>
                <div className="v41-hero-actions">
                  <button className="v41-primary" onClick={() => setActive("Tenants")}>Open tenant registry <ChevronRight size={15}/></button>
                  <button className="v41-secondary" onClick={() => setActive("Audit Logs")}>Inspect activity <Activity size={14}/></button>
                </div>
              </div>
              <div className="v41-radar" aria-hidden="true">
                <div className="v41-radar-grid" /><div className="v41-radar-ring r1"/><div className="v41-radar-ring r2"/><div className="v41-radar-ring r3"/>
                <div className="v41-radar-core"><ShieldCheck size={25}/><small>ARKA</small></div>
                <i className="v41-signal s1"/><i className="v41-signal s2"/><i className="v41-signal s3"/>
              </div>
            </section>

            <section className="v41-kpis">
              <div className="v41-kpi"><span>01 / TENANTS</span><strong>{counts.tenants}</strong><small>{counts.activeTenants} active organizations</small><i/></div>
              <div className="v41-kpi"><span>02 / IDENTITIES</span><strong>{counts.users}</strong><small>registered platform profiles</small><i/></div>
              <div className="v41-kpi"><span>03 / APPLICATIONS</span><strong>{counts.apps}</strong><small>connected applications</small><i/></div>
              <div className="v41-kpi live"><span>04 / CONTROL PLANE</span><strong>LIVE</strong><small>Supabase operational</small><i/></div>
            </section>

            <section className="v41-lower-grid">
              <div className="v41-activity">
                <div className="v41-section-head"><div><span>ACTIVITY STREAM</span><h3>What changed</h3></div><button onClick={() => setActive("Audit Logs")}>All events <ChevronRight size={13}/></button></div>
                {audit.length ? audit.slice(0,5).map((a, index) => <div className="v41-event" key={String(a.id)}><div className="v41-event-index">0{index+1}</div><div className="v41-event-line"><i/><span/></div><div className="v41-event-body"><b>{a.action.replaceAll("_", " ")}</b><small>{a.entity_type || "platform"} · {tenantName(a.tenant_id)}</small></div><time>{timeAgo(a.created_at)}</time></div>) : <div className="v41-empty">No platform events yet. New activity will appear here.</div>}
              </div>
              <div className="v41-control">
                <div className="v41-section-head"><div><span>CONTROL SURFACE</span><h3>Platform state</h3></div><span className="v41-state">NOMINAL</span></div>
                <div className="v41-state-map"><div className="v41-state-node root"><ShieldCheck size={18}/><b>ARKA</b><small>control plane</small></div><div className="v41-state-link l1"/><div className="v41-state-link l2"/><div className="v41-state-link l3"/><div className="v41-state-node n1"><Database size={14}/><b>Tenants</b><small>{counts.tenants} records</small></div><div className="v41-state-node n2"><Users size={14}/><b>Identities</b><small>{counts.users} records</small></div><div className="v41-state-node n3"><AppWindow size={14}/><b>Apps</b><small>{counts.apps} records</small></div></div>
                <div className="v41-control-foot"><span><i/> Authenticated</span><span><i/> RLS enforced</span><span><i/> Live database</span></div>
              </div>
            </section>
          </>}

          {active === "Tenants" && <section className="tenant-registry-v42">
            <div className="tenant-registry-head">
              <div><p className="tenant-eyebrow"><span/> LIVE TENANT REGISTRY</p><h2>Organizations</h2><p>Every organization connected to the ARKA control plane, sourced directly from Supabase.</p></div>
              <div className="tenant-registry-actions"><button className="tenant-action" onClick={() => void loadLiveData()} disabled={loadingData}><RefreshCw size={14} className={loadingData ? "spin" : ""}/> {loadingData ? "Syncing" : "Sync registry"}</button></div>
            </div>
            <div className="tenant-registry-metrics"><div><span>TOTAL</span><strong>{counts.tenants}</strong><small>organizations</small></div><div><span>ACTIVE</span><strong>{counts.activeTenants}</strong><small>operational</small></div><div><span>INACTIVE</span><strong>{Math.max(0, counts.tenants-counts.activeTenants)}</strong><small>not active</small></div><div><span>VIEW</span><strong>{filteredTenants.length}</strong><small>matching records</small></div></div>
            <div className="tenant-registry-card">
              <div className="tenant-table-head"><div><span>ORGANIZATION DIRECTORY</span><h3>Tenant records</h3></div><b>{filteredTenants.length} visible</b></div>
              <div className="tenant-table"><div className="tenant-row tenant-row-head"><span>Organization</span><span>Slug</span><span>Status</span><span>Created</span></div>{filteredTenants.length ? filteredTenants.map(t => <div className="tenant-row" key={t.id}><span className="tenant-name"><i/><div><strong>{t.name || "Unnamed organization"}</strong><small>{t.id}</small></div></span><span className="tenant-slug">{t.slug || "—"}</span><span><Status value={t.status} /></span><span className="tenant-created">{new Date(t.created_at).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"})}</span></div>) : <div className="tenant-empty"><Database size={22}/><strong>No organizations yet</strong><span>Complete tenant onboarding and the organization will appear here automatically.</span></div>}</div>
            </div>
          </section>}

          {active === "Users" && <section className="admin-panel admin-panel-v34 admin-table-panel"><TableHeader eyebrow="IDENTITY REGISTRY" title="Platform users" count={filteredUsers.length} /><div className="live-table"><div className="table-row table-head"><span>User</span><span>Role</span><span>Tenant</span><span>Status</span></div>{filteredUsers.length ? filteredUsers.map(u => <div className="table-row" key={u.id}><span className="entity-cell"><b>{u.full_name || "Unnamed user"}</b><small>{u.email}</small></span><span>{u.role || "—"}</span><span>{tenantName(u.tenant_id)}</span><span><Status value={u.status} /></span></div>) : <Empty title="No users found" text="Users will appear as soon as profiles exist." />}</div></section>}

          {active === "Apps" && <section className="admin-panel admin-panel-v34 admin-table-panel"><TableHeader eyebrow="APPLICATION REGISTRY" title="Connected applications" count={filteredApps.length} /><div className="live-table"><div className="table-row table-head"><span>Application</span><span>Tenant</span><span>Status</span><span>Created</span></div>{filteredApps.length ? filteredApps.map(a => <div className="table-row" key={a.id}><span className="entity-cell"><b>{a.name || "Unnamed app"}</b><small>{a.slug}</small></span><span>{tenantName(a.tenant_id)}</span><span><Status value={a.status} /></span><span>{new Date(a.created_at).toLocaleDateString()}</span></div>) : <Empty title="No applications found" text="Connected applications will appear here." />}</div></section>}

          {active === "Audit Logs" && <section className="admin-panel admin-panel-v34"><TableHeader eyebrow="IMMUTABLE ACTIVITY" title="Audit log" count={audit.length} /><div className="audit-list">{audit.length ? audit.map(a => <ActivityRow key={String(a.id)} audit={a} tenantName={tenantName} />) : <Empty title="No audit events yet" text="Platform actions will be recorded here." />}</div></section>}

          {active === "Roles & Permissions" && <section className="admin-panel admin-panel-v34"><TableHeader eyebrow="AUTHORIZATION MODEL" title="Roles & permissions" count={3} /><div className="role-grid-v34"><RoleCard code="SUPER_ADMIN" title="Super Admin" text="Platform-wide control. No tenant membership required." /><RoleCard code="TENANT_ADMIN" title="Tenant Admin" text="Organization administration and first-login onboarding." /><RoleCard code="TENANT_USER" title="Tenant User" text="Scoped access inside an assigned organization." /></div></section>}
          {active === "Integrations" && <Placeholder title="Integrations" text="Platform integrations will connect here to ARKA's application and security context." />}
          {active === "Settings" && <Placeholder title="Settings" text="Platform configuration, security policy and system preferences." />}
        </div>
      </main>
    </div>
  );
}

function ArrowRightGlyph(){return <ChevronRight size={14}/>}
function TableHeader({ eyebrow, title, count }: { eyebrow:string; title:string; count:number }) { return <div className="panel-title"><div><p className="eyebrow"><span /> {eyebrow}</p><h2>{title}</h2></div><span className="table-count">{count} records</span></div>; }
function Stat({label,value,meta,good=false}:{label:string;value:string;meta:string;good?:boolean}){return <div className="admin-stat"><small>{label}</small><strong>{value}</strong><span className={good?"good":""}>{good && <i />} {meta}</span></div>}
function Status({value}:{value:string}){const normalized=String(value||"unknown").toLowerCase();return <span className={`status-pill ${normalized}`}><i />{value || "Unknown"}</span>}
function ActivityRow({audit,tenantName}:{audit:Audit;tenantName:(id:string|null)=>string}){return <div className="activity-row activity-row-v34"><span className="activity-symbol">◈</span><div><b>{audit.action.replaceAll("_"," ")}</b><small>{audit.entity_type || "platform"}{audit.entity_id ? ` · ${String(audit.entity_id).slice(0,8)}` : ""} · {tenantName(audit.tenant_id)}</small></div><time>{timeAgo(audit.created_at)}</time></div>}
function Empty({title,text}:{title:string;text:string}){return <div className="admin-empty"><Database size={20}/><strong>{title}</strong><span>{text}</span></div>}
function RoleCard({code,title,text}:{code:string;title:string;text:string}){return <div className="role-card-v34"><span>{code}</span><ShieldCheck size={18}/><h3>{title}</h3><p>{text}</p></div>}
function Placeholder({title,text}:{title:string;text:string}){return <section className="admin-panel admin-panel-v34 admin-placeholder-v34"><p className="eyebrow"><span /> PLATFORM MODULE</p><h2>{title}</h2><p>{text}</p></section>}
