import { useEffect, useState } from "react";
import {
  Activity, AppWindow, ChevronRight, Database, GitBranch, LogOut,
  Menu, Settings, ShieldCheck, UserRound, Users, X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";

type Role = "super_admin" | "tenant_admin" | "tenant_user";

const nav = [
  ["Overview", Activity],
  ["Tenants", Database],
  ["Users", UserRound],
  ["Apps", AppWindow],
  ["Roles & Permissions", ShieldCheck],
  ["Audit Logs", Activity],
  ["Integrations", GitBranch],
  ["Settings", Settings],
] as const;

export default function Admin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [active, setActive] = useState("Overview");
  const [sidebar, setSidebar] = useState(false);
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      if (!supabaseConfigured || !supabase) {
        navigate("/login", { replace: true });
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        if (mounted) {
          setChecking(false);
          setAccessError(userError?.message || "Your authentication session could not be verified.");
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role, tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        if (mounted) {
          setChecking(false);
          setAccessError(
            `Authentication succeeded, but Arka could not read your profile. ${profileError.message}`
          );
        }
        return;
      }

      if (!profile) {
        if (mounted) {
          setChecking(false);
          setAccessError(
            "Authentication succeeded, but no Arka profile exists for this account."
          );
        }
        return;
      }

      const userRole = profile.role as Role;

      if (userRole !== "super_admin") {
        // Tenant Admin/User dashboards will be added as separate protected routes.
        if (mounted) {
          setChecking(false);
          navigate(
            userRole === "tenant_admin" ? "/tenant" : "/app",
            { replace: true }
          );
        }
        return;
      }

      if (mounted) {
        setEmail(user.email ?? "");
        setFullName(profile.full_name ?? "");
        setRole(userRole);
        setChecking(false);
      }
    }

    loadUser();

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

  if (checking) {
    return (
      <div className="auth-loading">
        <div className="loading-mark">◈</div>
        <p>Verifying secure access…</p>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="auth-loading">
        <Brand />
        <div className="placeholder-card access-error-card">
          <ShieldCheck size={28} />
          <p className="eyebrow"><span /> ACCESS VERIFICATION FAILED</p>
          <h1>We couldn't verify your access.</h1>
          <p>{accessError}</p>
          <div className="error-actions">
            <button className="button button-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
            <button className="button button-ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!role) return null;

  return (
    <div className="admin">
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <Brand />
        <div className="role-badge">
          <ShieldCheck size={13} />
          <span>SUPER ADMIN</span>
        </div>

        <div className="sidebar-nav">
          {nav.map(([label, Icon], i) => (
            <button
              key={label}
              className={active === label ? "active" : ""}
              onClick={() => {
                setActive(label);
                setSidebar(false);
              }}
            >
              <Icon size={16} />
              {label}
              {i === 0 && <span className="nav-arrow"><ChevronRight size={13} /></span>}
            </button>
          ))}
        </div>

        <button className="signout" onClick={logout}>
          <LogOut size={15} /> Sign out
        </button>
      </aside>

      {sidebar && (
        <button
          className="mobile-backdrop"
          onClick={() => setSidebar(false)}
          aria-label="Close menu"
        />
      )}

      <main className="admin-main">
        <header className="admin-header">
          <button
            className="mobile-menu"
            onClick={() => setSidebar(v => !v)}
            aria-label="Open navigation"
          >
            {sidebar ? <X /> : <Menu />}
          </button>

          <div>
            <p className="eyebrow"><span /> GLOBAL ADMIN SYSTEM</p>
            <h1>{active}</h1>
          </div>

          <div className="admin-user">
            <span className="online" />
            <div className="admin-user-text">
              <strong>{fullName || "Super Admin"}</strong>
              <small>{email}</small>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="admin-content">
          <motion.section
            className="admin-stats"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Stat label="Total Tenants" value="24" change="↑ 12% this month" />
            <Stat label="Total Users" value="1,248" change="↑ 18% this month" />
            <Stat label="Active Apps" value="36" change="↑ 8% this month" />
            <Stat label="System Health" value="99.9%" change="● Healthy" good />
          </motion.section>

          <section className="admin-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow"><span /> RECENT ACTIVITY</p>
                <h2>System activity</h2>
              </div>
              <button className="button button-ghost">View audit log →</button>
            </div>

            <div className="activity-row">
              <span className="activity-symbol">◈</span>
              <div><b>Tenant created</b><small>New organization added to the platform</small></div>
              <time>2 min ago</time>
            </div>
            <div className="activity-row">
              <span className="activity-symbol">○</span>
              <div><b>User access updated</b><small>Role permissions were modified</small></div>
              <time>10 min ago</time>
            </div>
            <div className="activity-row">
              <span className="activity-symbol">▦</span>
              <div><b>Application connected</b><small>New application registered</small></div>
              <time>24 min ago</time>
            </div>
          </section>

          <section className="admin-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow"><span /> PLATFORM ROADMAP</p>
                <h2>The foundation is ready.</h2>
              </div>
            </div>

            <div className="roadmap">
              {[
                ["Authentication", "Supabase Auth"],
                ["Role hierarchy", "Super Admin → Tenant User"],
                ["Tenant management", "Database + RLS"],
                ["Apps & integrations", "Git / Agent / Apps"],
              ].map(([title, subtitle], i) => (
                <div className={`roadmap-card ${i < 2 ? "done" : i === 2 ? "current" : ""}`} key={title}>
                  <b>0{i + 1}</b>
                  <strong>{title}</strong>
                  <small>{subtitle}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel security-summary">
            <div className="security-icon"><ShieldCheck size={24} /></div>
            <div>
              <p className="eyebrow"><span /> ACCESS VERIFIED</p>
              <h2>Super Admin privileges confirmed.</h2>
              <p>Your session is authenticated through Supabase and your Arka role is verified against the protected <code>profiles</code> table.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat({
  label, value, change, good = false
}: {
  label: string;
  value: string;
  change: string;
  good?: boolean;
}) {
  return (
    <div className="admin-stat">
      <small>{label}</small>
      <strong>{value}</strong>
      <span className={good ? "good" : ""}>{change}</span>
    </div>
  );
}
