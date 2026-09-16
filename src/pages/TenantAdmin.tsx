import { useEffect, useState } from "react";
import { AppWindow, ArrowRight, Bell, Cloud, Database, GitBranch, LayoutDashboard, LogOut, Menu, Network, Settings, ShieldCheck, Users, X } from "lucide-react";
import { motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAccessContext } from "../lib/access";
import TempleScene from "../components/TempleScene";
import Onboarding from "./Onboarding";

type Tenant = { id: string; name: string; slug: string; status: string; settings: any };

type Onboarding = {
  organizationName?: string; businessVertical?: string; organizationSize?: string;
  cloudPresence?: string[]; securityTechnologies?: string[];
  securityStack?: { siem?: string; edrXdr?: string; iam?: string; cloudSecurity?: string; other?: string };
  securityPriorities?: string[];
};

export default function TenantAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const focus = new URLSearchParams(location.search).get("focus");
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getAccessContext>>>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [context, setContext] = useState<Onboarding>({});
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(focus === "users" ? "Team" : focus === "integrations" ? "Integrations" : "Overview");
  const [sidebar, setSidebar] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabaseConfigured || !supabase) { navigate("/login", { replace: true }); return; }
      try {
        const a = await getAccessContext();
        if (!a) { navigate("/login", { replace: true }); return; }
        if (a.role === "SUPER_ADMIN") { navigate("/admin", { replace: true }); return; }
        if (a.role !== "TENANT_ADMIN" || !a.tenantId) { navigate("/app", { replace: true }); return; }
        const { data: t, error: tenantError } = await supabase.from("tenants").select("id,name,slug,status,settings").eq("id", a.tenantId).maybeSingle();
        if (tenantError) throw tenantError;
        const { data: ob } = await supabase.from("tenant_onboarding").select("step_data,completed").eq("tenant_id", a.tenantId).maybeSingle();
        const { data: ws } = await supabase.from("workspaces").select("name").eq("tenant_id", a.tenantId).eq("is_default", true).maybeSingle();
        if (!mounted) return;
        if (!mounted) return;
        setAccess(a);
        setTenant(t as Tenant);
        setContext((ob?.step_data ?? {}) as Onboarding);
        setWorkspaceName(ws?.name ?? `${(t as any)?.name ?? "Organization"} Security`);
        setShowOnboarding(!ob?.completed);
        setLoading(false);
      } catch (e) {
        if (mounted) { setError(e instanceof Error ? e.message : "Could not load organization."); setLoading(false); }
      }
    }
    load();
    return () => { mounted = false; };
  }, [navigate]);

  async function logout() { if (supabase) await supabase.auth.signOut(); navigate("/login", { replace: true }); }

  if (loading) return <div className="auth-loading"><div className="loading-mark">◈</div><p>Loading organization workspace…</p></div>;
  if (error || !access || !tenant) return <div className="auth-loading"><Brand /><div className="placeholder-card access-error-card"><ShieldCheck size={28}/><p className="eyebrow"><span/> WORKSPACE UNAVAILABLE</p><h1>We couldn't load your organization.</h1><p>{error}</p><button className="button button-primary" onClick={() => navigate("/onboarding")}>Return to setup</button></div></div>;

  const nav = [["Overview", LayoutDashboard], ["Team", Users], ["Applications", AppWindow], ["Integrations", GitBranch], ["Organization", Database], ["Settings", Settings]] as const;
  const stack = context.securityStack ?? {};

  return <div className="workspace">
    <aside className={`workspace-sidebar ${sidebar ? "open" : ""}`}>
      <div className="workspace-brand-row"><Brand/><span className="workspace-status"><i/> LIVE</span></div>
      <div className="workspace-role"><ShieldCheck size={13}/><span>TENANT ADMIN</span></div>
      <nav className="workspace-nav">{nav.map(([label, Icon]) => <button key={label} className={active === label ? "active" : ""} onClick={() => {setActive(label);setSidebar(false)}}><Icon size={17}/><span>{label}</span>{active === label && <ArrowRight size={14}/>}</button>)}</nav>
      <div className="workspace-sidebar-bottom"><button className="workspace-signout" onClick={logout}><LogOut size={16}/> Sign out</button></div>
    </aside>
    {sidebar && <button className="workspace-backdrop" onClick={() => setSidebar(false)} aria-label="Close menu"/>}
    <main className="workspace-main">
      <header className="workspace-header"><button className="workspace-menu" onClick={() => setSidebar(v => !v)} aria-label="Open navigation">{sidebar ? <X/> : <Menu/>}</button><div><p className="eyebrow"><span/> ARKA / ORGANIZATION CONTROL</p><h1>{active}</h1></div><div className="workspace-header-actions"><button className="workspace-icon" aria-label="Notifications"><Bell size={17}/><i/></button><ThemeToggle/><div className="workspace-user"><div className="workspace-avatar">{(access.fullName || access.email || "A").charAt(0).toUpperCase()}</div><div><strong>{access.fullName || "Tenant Admin"}</strong><small>{access.email}</small></div></div></div></header>
      <div className="workspace-content">
        {active === "Overview" && <>
          <motion.section className="workspace-welcome" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}><div><p className="eyebrow"><span/> WORKSPACE READY</p><h2>Welcome to ARKA, {access.fullName || "Admin"}.</h2><p>Your {tenant.name} security workspace is ready.</p></div><div className="workspace-command"><span className="workspace-command-dot"/><span>WORKSPACE</span><b>{workspaceName}</b></div></motion.section>
          <section className="workspace-stats"><Metric label="Organization" value={context.organizationName || tenant.name} icon={<Database size={17}/>} /><Metric label="Cloud" value={(context.cloudPresence ?? []).join(" · ") || "Not specified"} icon={<Cloud size={17}/>} /><Metric label="Security stack" value={Object.values(stack).filter(Boolean).length ? "Configured" : "Starting"} icon={<ShieldCheck size={17}/>} /><Metric label="Context graph" value="SYNC" icon={<Network size={17}/>} good /></section>
          <section className="tenant-admin-temple"><TempleScene mode="workspace" compact /></section>
          <section className="workspace-grid"><Panel icon={<Users/>} title="Build your security team" text="Invite security team members to collaborate in ARKA." action="Invite user" onClick={() => setActive("Team")} /><Panel icon={<GitBranch/>} title="Connect applications" text="Start building the connected security context for this organization." action="Connect →" onClick={() => setActive("Integrations")} /></section>
          <section className="workspace-panel"><div className="workspace-panel-head"><div><p className="eyebrow"><span/> YOUR ORGANIZATION</p><h3>Initial security context</h3></div></div><div className="welcome-summary"><div><small>Business vertical</small><strong>{context.businessVertical || "—"}</strong></div><div><small>Organization size</small><strong>{context.organizationSize || "—"}</strong></div><div><small>Technologies</small><strong>{(context.securityTechnologies ?? []).join(" · ") || "—"}</strong></div><div><small>Priorities</small><strong>{(context.securityPriorities ?? []).slice(0, 2).join(" · ") || "—"}</strong></div></div></section>
        </>}
        {active === "Team" && <Placeholder title="Team" text="Tenant Admins can invite, disable and manage tenant users here."/>}
        {active === "Applications" && <Placeholder title="Applications" text="This is the inventory boundary for organization applications and assets."/>}
        {active === "Integrations" && <Placeholder title="Integrations" text="Connect cloud providers and security tools such as SIEM, EDR/XDR and IAM."/>}
        {active === "Organization" && <Placeholder title="Organization" text={`${tenant.name} · ${context.businessVertical || "Business context not specified"} · ${workspaceName}`}/>}        
        {active === "Settings" && <Placeholder title="Settings" text="Organization settings, AI policy, notifications and security configuration belong here."/>}
      </div>
    </main>
    {showOnboarding && (
      <Onboarding
        embedded
        onCompleted={() => setShowOnboarding(false)}
      />
    )}
  </div>;
}

function Metric({label,value,icon,good=false}:{label:string;value:string;icon:React.ReactNode;good?:boolean}){return <div className="workspace-metric"><div className="metric-icon">{icon}</div><small>{label}</small><strong>{value}</strong><span className={good?"good":""}>{good?"● All systems nominal":"Connected"}</span></div>}
function Panel({icon,title,text,action,onClick}:{icon:React.ReactNode;title:string;text:string;action:string;onClick:()=>void}){return <div className="workspace-panel"><div className="workspace-panel-head"><div>{icon}<h3>{title}</h3></div></div><p className="panel-copy">{text}</p><button className="button button-ghost" onClick={onClick}>{action}<ArrowRight size={14}/></button></div>}
function Placeholder({title,text}:{title:string;text:string}){return <section className="workspace-panel"><div className="workspace-panel-head"><div><p className="eyebrow"><span/> TENANT SURFACE</p><h3>{title}</h3></div></div><div className="workspace-empty"><Network size={22}/><strong>{title} is ready.</strong><span>{text}</span></div></section>}
