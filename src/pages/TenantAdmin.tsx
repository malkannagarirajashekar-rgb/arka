import { useEffect, useState } from "react";
import { AppWindow, ArrowRight, Bell, Cloud, Database, GitBranch, LayoutDashboard, LogOut, Menu, Network, Settings, ShieldCheck, Users, X } from "lucide-react";
import { motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAccessContext } from "../lib/access";
import TempleScene from "../components/TempleScene";
import TenantOnboardingOverlay from "../components/TenantOnboardingOverlay";

type Tenant = { id: string; name: string; slug: string; status: string; settings: any };

type TenantContext = {
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
  const [context, setContext] = useState<TenantContext>({});
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(focus === "users" ? "Team" : focus === "integrations" ? "Integrations" : "Overview");
  const [sidebar, setSidebar] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabaseConfigured || !supabase) { navigate("/login", { replace: true }); return; }
      try {
        const a = await getAccessContext();
        if (!a) { navigate("/login", { replace: true }); return; }

        // getAccessContext performs an independent platform-admin check before
        // resolving tenant access. Never allow a platform user to enter the
        // Tenant Admin shell, even if an old/stale tenant membership exists.
        if (a.role === "SUPER_ADMIN") {
          navigate("/admin", { replace: true });
          return;
        }

        // Authorization comes only from the server-side access context.
        // Never inspect Google/email metadata for a role.
        if (a.accessState !== "PENDING_TENANT_ONBOARDING" && !a.role) {
          navigate("/login", { replace: true });
          return;
        }

        if (a.role && a.role !== "TENANT_ADMIN") {
          navigate("/app", { replace: true });
          return;
        }

        const pendingTenant: Tenant = { id: "pending", name: "Your organization", slug: "pending", status: "onboarding", settings: {} };
        let t: Tenant = pendingTenant;
        let ob: any = null;
        let workspace = "";

        if (a.role === "TENANT_ADMIN" && a.tenantId) {
          const { data: tenantRow, error: tenantError } = await supabase.from("tenants").select("id,name,slug,status,settings").eq("id", a.tenantId).maybeSingle();
          if (tenantError) throw tenantError;
          if (tenantRow) t = tenantRow as Tenant;
          const { data: onboarding } = await supabase.from("tenant_onboarding").select("organization_name,business_vertical,organization_size,cloud_presence,security_technologies,security_stack,security_priorities,step_data,completed").eq("tenant_id", a.tenantId).maybeSingle();
          ob = onboarding;
          const { data: ws } = await supabase.from("workspaces").select("name").eq("tenant_id", a.tenantId).eq("is_default", true).maybeSingle();
          workspace = ws?.name ?? `${t.name} Security`;
        }

        if (!mounted) return;
        setAccess(a);
        setTenant(t);
        const saved = (ob?.step_data ?? {}) as TenantContext;
        setContext({
          ...saved,
          organizationName: ob?.organization_name || saved.organizationName,
          businessVertical: ob?.business_vertical || saved.businessVertical,
          organizationSize: ob?.organization_size || saved.organizationSize,
          cloudPresence: Array.isArray(ob?.cloud_presence) ? ob.cloud_presence : saved.cloudPresence,
          securityTechnologies: Array.isArray(ob?.security_technologies) ? ob.security_technologies : saved.securityTechnologies,
          securityStack: ob?.security_stack && typeof ob.security_stack === "object" ? { ...((saved.securityStack ?? {}) as any), ...ob.security_stack } : saved.securityStack,
          securityPriorities: Array.isArray(ob?.security_priorities) ? ob.security_priorities : saved.securityPriorities,
        });
        setWorkspaceName(workspace || "Organization Security");
        // Only two states can ever open the overlay:
        // 1) an authenticated TENANT_ADMIN with incomplete onboarding; or
        // 2) a brand-new signup with absolutely no active membership.
        // A role-less/stale access context is NOT enough by itself.
        const hasActiveTenantAdmin = a.role === "TENANT_ADMIN" && !!a.tenantId;
        const isEligibleNewSignup = a.accessState === "PENDING_TENANT_ONBOARDING" && !a.tenantId;
        setShowOnboarding((hasActiveTenantAdmin && !ob?.completed) || isEligibleNewSignup);
        setLoading(false);
      } catch (e) {
        if (mounted) { setError(e instanceof Error ? e.message : "Could not load organization."); setLoading(false); }
      }
    }
    load();
    return () => { mounted = false; };
  }, [navigate, refreshTick]);

  async function logout() { if (supabase) await supabase.auth.signOut(); navigate("/login", { replace: true }); }

  if (loading) return <div className="auth-loading"><div className="loading-mark">◈</div><p>Loading organization workspace…</p></div>;
  if (error || !access || !tenant) return <div className="auth-loading"><Brand /><div className="placeholder-card access-error-card"><ShieldCheck size={28}/><p className="eyebrow"><span/> WORKSPACE UNAVAILABLE</p><h1>We couldn't load your organization.</h1><p>{error}</p><button className="button button-primary" onClick={() => window.location.reload()}>Return to setup</button></div></div>;

  const nav = [["Overview", LayoutDashboard], ["Team", Users], ["Applications", AppWindow], ["Integrations", GitBranch], ["Organization", Database], ["Settings", Settings]] as const;
  const stack = context.securityStack ?? {};

  return <div className="workspace workspace-v47">
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
          <motion.section className="workspace-welcome workspace-welcome-v47" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}>
            <div className="workspace-welcome-copy">
              <p className="eyebrow"><span/> WORKSPACE READY <b className="v47-live-label">LIVE</b></p>
              <h2>Welcome to ARKA, {access.fullName || "Admin"}.</h2>
              <p>Your organization security workspace is connected to the context captured during onboarding.</p>
              <div className="v47-welcome-meta">
                <span><i/> {tenant.status === "active" ? "Organization active" : `Organization ${tenant.status}`}</span>
                <span>{context.businessVertical || "Business vertical pending"}</span>
              </div>
            </div>
            <div className="workspace-command workspace-command-v47"><span className="workspace-command-dot"/><span>WORKSPACE</span><b>{workspaceName}</b><small>SYNCED</small></div>
          </motion.section>

          <section className="workspace-stats workspace-stats-v47">
            <Metric label="Organization" value={context.organizationName || tenant.name} icon={<Database size={17}/>} meta={context.businessVertical || "Business context"} />
            <Metric label="Cloud environment" value={(context.cloudPresence ?? []).length ? `${(context.cloudPresence ?? []).length} connected` : "Not specified"} icon={<Cloud size={17}/>} meta={(context.cloudPresence ?? []).join(" · ") || "Awaiting environment details"} />
            <Metric label="Security stack" value={Object.values(stack).filter(Boolean).length ? `${Object.values(stack).filter(Boolean).length} configured` : "Starting"} icon={<ShieldCheck size={17}/>} meta={Object.entries(stack).filter(([,v]) => !!v).map(([k]) => k === "edrXdr" ? "EDR/XDR" : k).join(" · ") || "No tools recorded yet"} />
            <Metric label="Context graph" value="SYNC" icon={<Network size={17}/>} meta="Live organization context" good />
          </section>

          <section className="tenant-admin-temple tenant-admin-temple-v47">
            <div className="v47-section-bar"><div><p className="eyebrow"><span/> GUARDIAN / LIVE CONTEXT</p><h3>Organization context map</h3></div><span className="v47-live-chip"><i/> LIVE</span></div>
            <TempleScene mode="workspace" compact />
          </section>

          <section className="workspace-grid workspace-grid-v47">
            <Panel icon={<Users/>} title="Build your security team" text="Invite security team members to collaborate in ARKA." action="Invite user" onClick={() => setActive("Team")} />
            <Panel icon={<GitBranch/>} title="Connect applications" text="Start building the connected security context for this organization." action="Connect" onClick={() => setActive("Integrations")} />
          </section>

          <section className="workspace-panel workspace-panel-v47 context-panel-v47">
            <div className="workspace-panel-head"><div><p className="eyebrow"><span/> YOUR ORGANIZATION</p><h3>Initial security context</h3><p className="v47-panel-sub">Live values below are the organization context captured by the onboarding overlay.</p></div><span className="v47-context-state"><i/> {context.organizationName ? "CAPTURED" : "AWAITING SETUP"}</span></div>
            <div className="welcome-summary welcome-summary-v47">
              <div><small>Organization</small><strong>{context.organizationName || tenant.name || "—"}</strong></div>
              <div><small>Business vertical</small><strong>{context.businessVertical || "—"}</strong></div>
              <div><small>Organization size</small><strong>{context.organizationSize || "—"}</strong></div>
              <div><small>Cloud presence</small><strong>{(context.cloudPresence ?? []).join(" · ") || "—"}</strong></div>
              <div><small>Security technologies</small><strong>{(context.securityTechnologies ?? []).join(" · ") || "—"}</strong></div>
              <div><small>Security priorities</small><strong>{(context.securityPriorities ?? []).join(" · ") || "—"}</strong></div>
            </div>
            <div className="v47-stack-strip">
              {[["SIEM",stack.siem],["EDR / XDR",stack.edrXdr],["IAM",stack.iam],["Cloud security",stack.cloudSecurity],["Other",stack.other]].map(([label,value]) => <div key={label}><span>{label}</span><b>{value || "Not specified"}</b></div>)}
            </div>
          </section>
        </>}
        {active === "Team" && <Placeholder title="Team" text="Tenant Admins can invite, disable and manage tenant users here."/>}
        {active === "Applications" && <Placeholder title="Applications" text="This is the inventory boundary for organization applications and assets."/>}
        {active === "Integrations" && <Placeholder title="Integrations" text="Connect cloud providers and security tools such as SIEM, EDR/XDR and IAM."/>}
        {active === "Organization" && <Placeholder title="Organization" text={`${tenant.name} · ${context.businessVertical || "Business context not specified"} · ${workspaceName}`}/>}        
        {active === "Settings" && <Placeholder title="Settings" text="Organization settings, AI policy, notifications and security configuration belong here."/>}
      </div>
    </main>
    {showOnboarding && (
      <TenantOnboardingOverlay
        onCompleted={(destination) => {
          setShowOnboarding(false);
          setRefreshTick(v => v + 1);
          if (destination && destination !== "/tenant") navigate(destination, { replace: true });
        }}
      />
    )}
  </div>;
}

function Metric({label,value,icon,meta,good=false}:{label:string;value:string;icon:React.ReactNode;meta:string;good?:boolean}){return <div className="workspace-metric workspace-metric-v47"><div className="metric-icon">{icon}</div><small>{label}</small><strong>{value}</strong><span className={good?"good":""}>{good ? "● All systems nominal" : meta}</span></div>}
function Panel({icon,title,text,action,onClick}:{icon:React.ReactNode;title:string;text:string;action:string;onClick:()=>void}){return <div className="workspace-panel"><div className="workspace-panel-head"><div>{icon}<h3>{title}</h3></div></div><p className="panel-copy">{text}</p><button className="button button-ghost" onClick={onClick}>{action}<ArrowRight size={14}/></button></div>}
function Placeholder({title,text}:{title:string;text:string}){return <section className="workspace-panel"><div className="workspace-panel-head"><div><p className="eyebrow"><span/> TENANT SURFACE</p><h3>{title}</h3></div></div><div className="workspace-empty"><Network size={22}/><strong>{title} is ready.</strong><span>{text}</span></div></section>}
