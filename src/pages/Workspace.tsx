import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AppWindow,
  Bell,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAccessContext } from "../lib/access";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import TempleScene from "../components/TempleScene";

type Role = "tenant_admin" | "tenant_user";

type Profile = {
  full_name: string | null;
  role: Role;
  tenant_id: string | null;
};

type AppRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

const baseNav = [
  ["Overview", LayoutDashboard],
  ["Applications", AppWindow],
  ["Identity", CircleUserRound],
  ["Policy", ShieldCheck],
  ["Activity", Activity],
] as const;

export default function Workspace() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [email, setEmail] = useState("");
  const [active, setActive] = useState("Overview");
  const [sidebar, setSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadWorkspace() {
      if (!supabaseConfigured || !supabase) { navigate("/login", { replace: true }); return; }
      try {
        const access = await getAccessContext();
        if (!access) { navigate("/login", { replace: true }); return; }
        if (access.role === "SUPER_ADMIN") { navigate("/admin", { replace: true }); return; }
        if (!access.tenantId) { navigate("/onboarding", { replace: true }); return; }
        const { data: ob } = await supabase.from("tenant_onboarding").select("completed,step_data").eq("tenant_id", access.tenantId).maybeSingle();
        if (!ob?.completed) { navigate("/onboarding", { replace: true }); return; }
        const { data: appRows, error: appsError } = await supabase.from("apps").select("id,name,slug,status").eq("tenant_id", access.tenantId).order("created_at", { ascending: false });
        if (appsError) throw appsError;
        setProfile({ full_name: access.fullName, role: access.role === "TENANT_ADMIN" ? "tenant_admin" : "tenant_user", tenant_id: access.tenantId });
        setApps((appRows ?? []) as AppRecord[]); setEmail(access.email); setLoading(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Unable to load workspace."); setLoading(false); }
    }

    loadWorkspace();

    const { data: { subscription } } = supabaseConfigured && supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (!session) navigate("/login", { replace: true });
        })
      : { subscription: null };

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [navigate]);

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const activeTitle = useMemo(() => active, [active]);

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="loading-mark">◈</div>
        <p>Loading secure workspace…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="auth-loading">
        <Brand />
        <div className="placeholder-card access-error-card">
          <ShieldCheck size={28} />
          <p className="eyebrow"><span /> WORKSPACE UNAVAILABLE</p>
          <h1>We couldn't load your workspace.</h1>
          <p>{error || "Your account profile could not be loaded."}</p>
          <div className="error-actions">
            <button className="button button-primary" onClick={() => window.location.reload()}>Try again</button>
            <button className="button button-ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = profile.role === "tenant_admin" ? "TENANT ADMIN" : "TENANT USER";
  const activeApps = apps.filter((app) => app.status === "active").length;

  return (
    <div className="workspace">
      <aside className={`workspace-sidebar ${sidebar ? "open" : ""}`}>
        <div className="workspace-brand-row">
          <Brand />
          <span className="workspace-status"><i /> LIVE</span>
        </div>

        <div className="workspace-role"><ShieldCheck size={13} /><span>{roleLabel}</span></div>

        <nav className="workspace-nav">
          {baseNav.map(([label, Icon]) => (
            <button
              key={label}
              className={active === label ? "active" : ""}
              onClick={() => { setActive(label); setSidebar(false); }}
            >
              <Icon size={17} />
              <span>{label}</span>
              {active === label && <ChevronRight size={14} />}
            </button>
          ))}
          {profile.role === "tenant_admin" && (
            <button className={active === "Team" ? "active" : ""} onClick={() => { setActive("Team"); setSidebar(false); }}>
              <Users size={17} /><span>Team</span>{active === "Team" && <ChevronRight size={14} />}
            </button>
          )}
          <button className={active === "Settings" ? "active" : ""} onClick={() => { setActive("Settings"); setSidebar(false); }}>
            <Settings size={17} /><span>Settings</span>{active === "Settings" && <ChevronRight size={14} />}
          </button>
        </nav>

        <div className="workspace-sidebar-bottom">
          <button className="workspace-signout" onClick={logout}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      {sidebar && <button className="workspace-backdrop" onClick={() => setSidebar(false)} aria-label="Close menu" />}

      <main className="workspace-main">
        <header className="workspace-header">
          <button className="workspace-menu" onClick={() => setSidebar((value) => !value)} aria-label="Open navigation">
            {sidebar ? <X /> : <Menu />}
          </button>
          <div>
            <p className="eyebrow"><span /> ARKA / CONTROL PLANE</p>
            <h1>{activeTitle}</h1>
          </div>
          <div className="workspace-header-actions">
            <button className="workspace-icon" aria-label="Notifications"><Bell size={17} /><i /></button>
            <ThemeToggle />
            <div className="workspace-user">
              <div className="workspace-avatar">{(profile.full_name || email || "A").charAt(0).toUpperCase()}</div>
              <div><strong>{profile.full_name || "Arka user"}</strong><small>{email}</small></div>
            </div>
          </div>
        </header>

        <div className="workspace-content">
          <motion.section className="workspace-welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div>
              <p className="eyebrow"><span /> SECURE WORKSPACE</p>
              <h2>Good morning{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.</h2>
              <p>Your identity, applications and security state are connected in one place.</p>
            </div>
            <div className="workspace-command">
              <span className="workspace-command-dot" />
              <span>CONTROL PLANE</span>
              <b>Operational</b>
            </div>
          </motion.section>

          <section className="workspace-temple-strip"><div className="workspace-temple-intro"><p className="eyebrow"><span/> ARKA / SANCTUM</p><h3>Context at a glance.</h3><span>Select a seal to inspect a connected security layer.</span></div><TempleScene mode="workspace" compact /></section>

          <section className="workspace-stats">
            <Metric label="Protected apps" value={String(apps.length).padStart(2, "0")} icon={<AppWindow size={17} />} />
            <Metric label="Active services" value={String(activeApps).padStart(2, "0")} icon={<Network size={17} />} />
            <Metric label="Identity state" value="VERIFIED" icon={<CircleUserRound size={17} />} />
            <Metric label="Security state" value="NOMINAL" icon={<ShieldCheck size={17} />} good />
          </section>

          <section className="workspace-grid">
            <div className="workspace-panel workspace-apps-panel">
              <div className="workspace-panel-head">
                <div><p className="eyebrow"><span /> APPLICATION MESH</p><h3>Connected applications</h3></div>
                <span className="panel-count">{apps.length}</span>
              </div>
              {apps.length ? (
                <div className="workspace-app-list">
                  {apps.map((app) => (
                    <button key={app.id} className="workspace-app-row" onClick={() => setActive("Applications")}>
                      <span className="workspace-app-icon"><AppWindow size={16} /></span>
                      <span><strong>{app.name}</strong><small>{app.slug}</small></span>
                      <em className={app.status === "active" ? "online" : "offline"}>{app.status}</em>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="workspace-empty"><AppWindow size={22} /><strong>No applications connected yet.</strong><span>Applications assigned to your organization will appear here.</span></div>
              )}
            </div>

            <div className="workspace-panel security-panel">
              <div className="workspace-panel-head"><div><p className="eyebrow"><span /> SECURITY STATE</p><h3>Everything is accounted for.</h3></div><ShieldCheck size={21} /></div>
              <div className="security-orb"><div /><span>SECURE</span></div>
              <div className="security-list">
                <StatusRow label="Authentication" value="Verified" />
                <StatusRow label="Role boundary" value={roleLabel.replace("TENANT ", "")} />
                <StatusRow label="Tenant isolation" value={profile.tenant_id ? "Active" : "Pending"} />
              </div>
            </div>
          </section>

          <section className="workspace-panel workspace-flow">
            <div className="workspace-panel-head"><div><p className="eyebrow"><span /> ACCESS FLOW</p><h3>From identity to action.</h3></div><Network size={20} /></div>
            <div className="workspace-flow-steps">
              <FlowStep number="01" title="Identity" text="Authenticated user" />
              <FlowStep number="02" title="Policy" text="Role and tenant boundary" />
              <FlowStep number="03" title="Application" text={`${apps.length} protected destination${apps.length === 1 ? "" : "s"}`} />
              <FlowStep number="04" title="Response" text="Traceable activity" />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, icon, good = false }: { label: string; value: string; icon: React.ReactNode; good?: boolean }) {
  return <div className="workspace-metric"><div className="metric-icon">{icon}</div><small>{label}</small><strong>{value}</strong><span className={good ? "good" : ""}>{good ? "● All systems nominal" : "Connected"}</span></div>;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="security-status-row"><span>{label}</span><b><i />{value}</b></div>;
}

function FlowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="flow-step-card"><span>{number}</span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={15} /></div>;
}
