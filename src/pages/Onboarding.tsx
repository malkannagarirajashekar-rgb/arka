import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Cloud, HardDrive, Layers3, ShieldCheck,
  Sparkles, UsersRound
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { supabase, supabaseConfigured } from "../lib/supabase";
import TempleScene from "../components/TempleScene";

const CLOUDS = ["AWS", "Microsoft Azure", "Google Cloud", "Oracle", "Private Cloud", "On-Premises"];
const SECURITY_TECHNOLOGIES = ["SIEM", "EDR / XDR", "IAM", "SOAR", "Firewall", "WAF", "CNAPP", "Vulnerability Mgmt", "DLP", "PAM", "NDR", "Other"];
const PRIORITIES = [
  "Attack Surface Visibility", "Threat Intelligence", "Vulnerability Management",
  "Security Monitoring", "Threat Detection", "Investigation & Threat Hunting",
  "Incident Response", "Security Automation", "Compliance & Risk"
];

const steps = [
  { title: "Initial Security Profile", eyebrow: "01 / ORGANIZATION", icon: UsersRound },
  { title: "Technology Environment", eyebrow: "02 / ENVIRONMENT", icon: Cloud },
  { title: "Security Stack", eyebrow: "03 / SECURITY STACK", icon: HardDrive },
  { title: "Security Priorities", eyebrow: "04 / PRIORITIES", icon: Sparkles },
] as const;

type FormData = {
  organizationName: string;
  businessVertical: string;
  organizationSize: string;
  cloudPresence: string[];
  securityTechnologies: string[];
  securityStack: { siem: string; edrXdr: string; iam: string; cloudSecurity: string; other: string };
  securityPriorities: string[];
};

const initialData: FormData = {
  organizationName: "",
  businessVertical: "",
  organizationSize: "",
  cloudPresence: [],
  securityTechnologies: [],
  securityStack: { siem: "", edrXdr: "", iam: "", cloudSecurity: "", other: "" },
  securityPriorities: [],
};

export default function Onboarding({ embedded = false, onCompleted }: { embedded?: boolean; onCompleted?: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(initialData);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabaseConfigured || !supabase) {
        setLoading(false);
        setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { navigate("/login", { replace: true }); return; }

      const { data: profile } = await supabase.from("profiles").select("full_name, status").eq("id", user.id).maybeSingle();
      const { data: memberships } = await supabase
        .from("user_tenant_memberships")
        .select("tenant_id, roles(code, scope)")
        .eq("user_id", user.id)
        .eq("status", "active");
      const tenantMembership = memberships?.find((m: any) => m.roles?.code === "TENANT_ADMIN");
      const superAdmin = memberships?.some((m: any) => m.roles?.code === "SUPER_ADMIN");

      if (superAdmin) { navigate("/admin", { replace: true }); return; }
      if (memberships?.some((m: any) => m.roles?.code === "TENANT_USER")) { navigate("/app", { replace: true }); return; }

      if (tenantMembership?.tenant_id) {
        setTenantId(tenantMembership.tenant_id);
        const { data: onboarding } = await supabase
          .from("tenant_onboarding")
          .select("step_data, completed, current_step")
          .eq("tenant_id", tenantMembership.tenant_id)
          .maybeSingle();
        if (onboarding?.step_data) {
          setForm({ ...initialData, ...(onboarding.step_data as Partial<FormData>), securityStack: { ...initialData.securityStack, ...((onboarding.step_data as any).securityStack ?? {}) } });
        }
        if (onboarding?.completed) {
          const { data: ws } = await supabase.from("workspaces").select("id").eq("tenant_id", tenantMembership.tenant_id).eq("is_default", true).maybeSingle();
          setWorkspaceId(ws?.id ?? null);
          setComplete(true);
        } else if (typeof onboarding?.current_step === "number") {
          setStep(Math.min(3, Math.max(0, onboarding.current_step)));
        }
      }
      if (profile?.status === "pending") {
        // The onboarding RPC activates the profile after the workspace is created.
      }
      setLoading(false);
    }
    load().catch((e) => { if (active) { setError(e instanceof Error ? e.message : "Unable to load onboarding."); setLoading(false); } });
    return () => { active = false; };
  }, [navigate]);

  const activeStep = steps[step];
  const ActiveIcon = activeStep.icon;

  const valid = useMemo(() => {
    if (step === 0) return !!form.organizationName.trim() && !!form.businessVertical.trim();
    return true;
  }, [form.businessVertical, form.organizationName, step]);

  function toggleArray<K extends "cloudPresence" | "securityTechnologies" | "securityPriorities">(key: K, value: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((v) => v !== value) : [...current[key], value],
    }));
    setError("");
  }

  async function persist(completed: boolean, nextStep: number) {
    if (!supabase) return;
    setSaving(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("save_tenant_onboarding", {
      p_organization_name: form.organizationName.trim(),
      p_business_vertical: form.businessVertical.trim(),
      p_organization_size: form.organizationSize,
      p_cloud_presence: form.cloudPresence,
      p_security_technologies: form.securityTechnologies,
      p_security_stack: form.securityStack,
      p_security_priorities: form.securityPriorities,
      p_step: step + 1,
      p_step_data: form,
      p_completed: completed,
    });
    if (rpcError) { setSaving(false); setError(rpcError.message); return; }
    const tenant = data?.tenant_id as string | undefined;
    const workspace = data?.workspace_id as string | undefined;
    setTenantId(tenant ?? tenantId);
    setWorkspaceId(workspace ?? workspaceId);

    try {
      await supabase.functions.invoke("sync-organization-graph", {
        body: { tenant: tenant ?? tenantId, workspace: workspace ?? workspaceId, onboarding: form, step: step + 1, completed },
      });
    } catch {
      // Graph sync must not prevent the tenant from completing onboarding.
    }
    setSaving(false);
    if (completed) setComplete(true); else setStep(nextStep);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    await persist(step === 3, Math.min(3, step + 1));
  }

  if (loading) return <div className="auth-loading"><div className="loading-mark">◈</div><p>Preparing your security profile…</p></div>;

  if (complete) {
    return (
      <main className={embedded ? "onboarding-page onboarding-overlay-mode" : "onboarding-page"}>
        <div className="onboarding-overlay-backdrop" />
        <div className="onboarding-ambient onboarding-a" /><div className="onboarding-ambient onboarding-b" /><div className="onboarding-noise" />
        <header className="onboarding-top">{!embedded && <Brand />}<ThemeToggle /></header>
        <section className="welcome-panel shell">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="welcome-orb"><ShieldCheck size={30} /></div>
            <p className="eyebrow"><span /> WORKSPACE READY</p>
            <h1>Your ARKA workspace is <em>ready.</em></h1>
            <p className="welcome-copy">ARKA has configured your initial security view using the organization and environment context you provided.</p>
            <div className="welcome-summary">
              <div><small>Organization</small><strong>{form.organizationName}</strong></div>
              <div><small>Business context</small><strong>{form.businessVertical}</strong></div>
              <div><small>Infrastructure</small><strong>{form.cloudPresence.join(" · ") || "Not specified"}</strong></div>
              <div><small>Workspace</small><strong>{form.organizationName} Security</strong></div>
            </div>
            <div className="welcome-actions">
              <button className="gradient-button" onClick={() => { onCompleted?.(); navigate("/tenant?focus=users"); }}>Invite users <ArrowRight size={16} /></button>
              <button className="button button-ghost" onClick={() => { onCompleted?.(); navigate("/tenant?focus=integrations"); }}>Connect applications</button>
              <button className="button button-ghost" onClick={() => { onCompleted?.(); navigate("/app"); }}>Enter ARKA <ArrowRight size={16} /></button>
            </div>
          </motion.div>
        </section>
      </main>
    );
  }

  return (
    <main className={embedded ? "onboarding-page onboarding-overlay-mode" : "onboarding-page"}>
      <div className="onboarding-overlay-backdrop" />
      <div className="onboarding-ambient onboarding-a" /><div className="onboarding-ambient onboarding-b" /><div className="onboarding-noise" />
      <header className="onboarding-top shell">
        {!embedded ? <Brand /> : <div className="onboarding-overlay-brand"><Brand /><span>FIRST-LOGIN SETUP</span></div>}
        <ThemeToggle />
      </header>
      <section className="onboarding-shell shell">
        <div className="onboarding-head">
          <div>
            <p className="eyebrow"><span /> ORGANIZATION SETUP</p>
            <h1>Let’s understand your <em>security environment.</em></h1>
            <p>Most questions are optional. Each completed step is saved so your ARKA context grows with you.</p>
          </div>
          <div className="onboarding-count">{String(step + 1).padStart(2, "0")} <span>/ 04</span></div>
        </div>

        <div className="onboarding-progress">
          {steps.map((item, i) => (
            <button key={item.title} className={i === step ? "active" : i < step ? "done" : ""} onClick={() => i <= step && setStep(i)}>
              <span>{i < step ? <Check size={12} /> : String(i + 1).padStart(2, "0")}</span>{item.title}
            </button>
          ))}
        </div>
        <div className="onboarding-temple-wrap"><TempleScene mode="workspace" compact /></div>

        {embedded && <button type="button" className="onboarding-overlay-exit" onClick={async () => { if (supabase) await supabase.auth.signOut(); navigate("/login", { replace: true }); }}><ArrowLeft size={14} /> Sign out</button>}
        <motion.form key={step} className="onboarding-card" onSubmit={submit} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}>
          <div className="onboarding-card-head">
            <div className="onboarding-step-icon"><ActiveIcon size={20} /></div>
            <div><p className="eyebrow"><span /> {activeStep.eyebrow}</p><h2>{activeStep.title}</h2></div>
          </div>

          {step === 0 && <div className="onboarding-grid two">
            <Field label="Organization Name" value={form.organizationName} required placeholder="Acme Corporation" onChange={(v) => setForm((f) => ({ ...f, organizationName: v }))} />
            <Field label="Business Vertical" value={form.businessVertical} required placeholder="Financial Services, Technology…" onChange={(v) => setForm((f) => ({ ...f, businessVertical: v }))} />
            <fieldset className="choice-group wide"><legend>Organization Size</legend><Choice value="1–100" active={form.organizationSize === "1–100"} onClick={() => setForm((f) => ({ ...f, organizationSize: "1–100" }))} /><Choice value="101–500" active={form.organizationSize === "101–500"} onClick={() => setForm((f) => ({ ...f, organizationSize: "101–500" }))} /><Choice value="501–5,000" active={form.organizationSize === "501–5,000"} onClick={() => setForm((f) => ({ ...f, organizationSize: "501–5,000" }))} /><Choice value="5,000+" active={form.organizationSize === "5,000+"} onClick={() => setForm((f) => ({ ...f, organizationSize: "5,000+" }))} /></fieldset>
          </div>}

          {step === 1 && <div className="onboarding-grid">
            <fieldset className="choice-group"><legend>Cloud Presence</legend><div className="choice-grid">{CLOUDS.map((v) => <CheckChoice key={v} value={v} active={form.cloudPresence.includes(v)} onClick={() => toggleArray("cloudPresence", v)} />)}</div></fieldset>
            <fieldset className="choice-group"><legend>Security Technology</legend><div className="choice-grid">{SECURITY_TECHNOLOGIES.map((v) => <CheckChoice key={v} value={v} active={form.securityTechnologies.includes(v)} onClick={() => toggleArray("securityTechnologies", v)} />)}</div></fieldset>
          </div>}

          {step === 2 && <div className="onboarding-grid two">
            <Field label="SIEM" value={form.securityStack.siem} placeholder="e.g. Splunk, Sentinel, QRadar" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, siem: v } }))} />
            <Field label="EDR / XDR" value={form.securityStack.edrXdr} placeholder="e.g. CrowdStrike, Defender" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, edrXdr: v } }))} />
            <Field label="IAM" value={form.securityStack.iam} placeholder="e.g. Okta, Entra ID, CyberArk" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, iam: v } }))} />
            <Field label="Cloud Security" value={form.securityStack.cloudSecurity} placeholder="e.g. Prisma Cloud, Wiz" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, cloudSecurity: v } }))} />
            <div className="onboarding-grid wide"><Field label="Other technologies / tools" value={form.securityStack.other} placeholder="Other security products or technologies" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, other: v } }))} /></div>
          </div>}

          {step === 3 && <div className="onboarding-grid">
            <fieldset className="choice-group"><legend>Select everything that applies</legend><div className="choice-grid priorities">{PRIORITIES.map((v) => <CheckChoice key={v} value={v} active={form.securityPriorities.includes(v)} onClick={() => toggleArray("securityPriorities", v)} />)}</div></fieldset>
          </div>}

          {error && <p className="login-error" role="alert">{error}</p>}
          <div className="onboarding-footer">
            <button
              type="button"
              className="button button-ghost"
              onClick={async () => {
                if (step !== 0) {
                  setStep(step - 1);
                  return;
                }
                setSaving(true);
                setError("");
                try {
                  if (supabase) {
                    const { error: signOutError } = await supabase.auth.signOut();
                    if (signOutError) throw signOutError;
                  }
                  sessionStorage.setItem("arka-signed-out", "1");
                  navigate("/login", { replace: true });
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Unable to sign out.");
                  setSaving(false);
                }
              }}
              disabled={saving}
            >
              <ArrowLeft size={15} /> {step === 0 ? "Sign out" : "Back"}
            </button>
            <div className="onboarding-save"><span>{saving ? "Saving…" : "Saved after each step"}</span></div>
            <button className="gradient-button" disabled={!valid || saving}>{step === 3 ? "Finish setup" : "Save & continue"} <ArrowRight size={16} /></button>
          </div>
        </motion.form>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return <label className="onboarding-field"><span>{label}{required && <b> *</b>}</span><input value={value} required={required} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

function Choice({ value, active, onClick }: { value: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`choice-button ${active ? "selected" : ""}`} onClick={onClick}><span className="choice-dot" />{value}</button>;
}

function CheckChoice({ value, active, onClick }: { value: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`check-choice ${active ? "selected" : ""}`} onClick={onClick}><span>{active ? <Check size={13} /> : null}</span>{value}</button>;
}
