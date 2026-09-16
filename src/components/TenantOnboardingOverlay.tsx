import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ArrowRight, Check, Cloud, HardDrive, Layers3, ShieldCheck,
  Sparkles, UsersRound
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAccessContext } from "../lib/access";
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

export default function Onboarding({ onCompleted }: { onCompleted?: (destination?: string) => void }) {
  const [portalReady, setPortalReady] = useState(false);
  const embedded = true;

  useEffect(() => { setPortalReady(true); }, []);

  useEffect(() => {
    // The overlay owns the viewport while it is open. The underlying Tenant
    // Admin workspace remains mounted, but the page itself cannot scroll under
    // the modal and reveal/hide it accidentally.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
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

      const access = await getAccessContext();
      if (!access) { navigate("/login", { replace: true }); return; }
      if (access.role === "SUPER_ADMIN") {
        navigate("/admin", { replace: true });
        return;
      }
      if (access.role && access.role !== "TENANT_ADMIN") {
        navigate("/app", { replace: true });
        return;
      }

      const { data: memberships } = await supabase
        .from("user_tenant_memberships")
        .select("tenant_id, roles(code, scope)")
        .eq("user_id", access.userId)
        .eq("status", "active");
      const tenantMembership = memberships?.find((m: any) => String(m.roles?.code ?? "").toUpperCase() === "TENANT_ADMIN");
      const membershipIsSuperAdmin = memberships?.some((m: any) => String(m.roles?.code ?? "").toUpperCase() === "SUPER_ADMIN");
      if (membershipIsSuperAdmin) {
        navigate("/admin", { replace: true });
        return;
      }
      if (memberships?.some((m: any) => String(m.roles?.code ?? "").toUpperCase() === "TENANT_USER")) {
        navigate("/app", { replace: true });
        return;
      }

      const pendingBootstrap = !tenantMembership && (memberships?.length ?? 0) === 0 && access.accessState === "PENDING_TENANT_ONBOARDING";
      if (!tenantMembership && !pendingBootstrap) {
        navigate("/login", { replace: true });
        return;
      }

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
    const { data, error: rpcError } = await supabase.rpc("save_arka_tenant_onboarding", {
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
    if (rpcError) {
      setSaving(false);
      const message = rpcError.message || "ARKA could not save this step.";
      setError(message.includes("more than one row")
        ? "ARKA found duplicate legacy onboarding data. The repair is being applied; please try Save & continue again."
        : message);
      return;
    }
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

  function completeTo(destination: string) {
    if (onCompleted) onCompleted(destination);
    else navigate(destination, { replace: true });
  }

  const overlayClass = embedded ? "arka-onboarding-overlay" : "onboarding-page";

  if (complete) {
    return (
      <div className={overlayClass} role="dialog" aria-modal="true" aria-label="ARKA organization setup complete">
        <div className="arka-onboarding-backdrop" />
        <div className="arka-onboarding-modal arka-onboarding-complete">
          <div className="arka-onboarding-topline">
            <div className="arka-onboarding-brand"><Brand /><span>CONTEXT STUDIO</span></div>
            <div className="arka-onboarding-top-actions"><span className="arka-live"><i /> SECURE SESSION</span><ThemeToggle /></div>
          </div>
          <div className="arka-onboarding-complete-grid">
            <div className="arka-complete-mark"><ShieldCheck size={30} /></div>
            <p className="arka-overline">ORGANIZATION CONTEXT COMPLETE</p>
            <h1>Your security context is <em>ready.</em></h1>
            <p className="arka-complete-copy">ARKA has captured the organization, technology and priority context you provided. Your workspace is ready for the next layer of configuration.</p>
            <div className="arka-context-summary">
              <div><small>Organization</small><strong>{form.organizationName}</strong></div>
              <div><small>Business context</small><strong>{form.businessVertical}</strong></div>
              <div><small>Infrastructure</small><strong>{form.cloudPresence.join(" · ") || "Not specified"}</strong></div>
              <div><small>Workspace</small><strong>{form.organizationName} Security</strong></div>
            </div>
            <div className="arka-complete-actions">
              <button className="arka-primary-action" onClick={() => completeTo("/tenant?focus=users")}>Invite users <ArrowRight size={16} /></button>
              <button className="arka-secondary-action" onClick={() => completeTo("/tenant?focus=integrations")}>Connect applications</button>
              <button className="arka-secondary-action" onClick={() => completeTo("/app")}>Enter ARKA <ArrowRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!portalReady) return null;

  return createPortal((
    <div className={overlayClass} role="dialog" aria-modal="true" aria-label="ARKA organization onboarding">
      <div className="arka-onboarding-backdrop" />
      <section className="arka-onboarding-modal">
        <header className="arka-onboarding-topline">
          <div className="arka-onboarding-brand"><Brand /><span>CONTEXT STUDIO / ORGANIZATION SETUP</span></div>
          <div className="arka-onboarding-top-actions">
            <span className="arka-live"><i /> SECURE SESSION</span>
            <ThemeToggle />
            {embedded && <button type="button" className="arka-close-action" onClick={async () => { if (supabase) await supabase.auth.signOut(); navigate("/login", { replace: true }); }}><ArrowLeft size={14} /> Exit</button>}
          </div>
        </header>

        <div className="arka-onboarding-body">
          <aside className="arka-onboarding-rail">
            <div className="arka-rail-intro"><span>ARKA</span><strong>Build the<br />security context.</strong><p>Four short passes. Each one is saved to your organization as you continue.</p></div>
            <div className="arka-step-list">
              {steps.map((item, i) => {
                const Icon = item.icon;
                return <button key={item.title} className={`arka-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`} onClick={() => i <= step && setStep(i)}>
                  <span className="arka-step-num">{i < step ? <Check size={13} /> : String(i + 1).padStart(2, "0")}</span>
                  <span className="arka-step-copy"><small>{item.eyebrow.replace(" / ", " · ")}</small><b>{item.title}</b></span>
                  <Icon size={16} />
                </button>;
              })}
            </div>
            <div className="arka-rail-footer"><span>CONTEXT ENGINE</span><i /><small>Ready to learn your environment</small></div>
          </aside>

          <div className="arka-onboarding-workspace">
            <div className="arka-workspace-head">
              <div><p className="arka-overline">{activeStep.eyebrow}</p><h1>{step === 0 ? <>Tell us about your <em>organization.</em></> : step === 1 ? <>Map your <em>environment.</em></> : step === 2 ? <>Understand your <em>security stack.</em></> : <>Set your <em>priorities.</em></>}</h1></div>
              <div className="arka-step-counter"><strong>{String(step + 1).padStart(2, "0")}</strong><span>/ 04</span></div>
            </div>

            <div className="arka-progress-line"><span style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>

            <motion.form key={step} className="arka-form-card" onSubmit={submit} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="arka-form-card-head">
                <div className="arka-form-icon"><ActiveIcon size={19} /></div>
                <div><small>{activeStep.eyebrow}</small><h2>{activeStep.title}</h2></div>
                <span className="arka-autosave">{saving ? "SAVING" : "AUTO-SAVED"}</span>
              </div>

              {step === 0 && <div className="arka-form-grid two">
                <Field label="Organization name" value={form.organizationName} required placeholder="Acme Corporation" onChange={(v) => setForm((f) => ({ ...f, organizationName: v }))} />
                <Field label="Business vertical" value={form.businessVertical} required placeholder="Financial Services, Technology…" onChange={(v) => setForm((f) => ({ ...f, businessVertical: v }))} />
                <fieldset className="arka-choice-panel wide"><legend>Organization size <span>Optional</span></legend><div className="arka-choice-grid">{["1–100", "101–500", "501–5,000", "5,000+"].map(v => <Choice key={v} value={v} active={form.organizationSize === v} onClick={() => setForm(f => ({ ...f, organizationSize: v }))} />)}</div></fieldset>
              </div>}

              {step === 1 && <div className="arka-form-grid">
                <fieldset className="arka-choice-panel"><legend>Cloud presence <span>Optional</span></legend><div className="arka-check-grid">{CLOUDS.map(v => <CheckChoice key={v} value={v} active={form.cloudPresence.includes(v)} onClick={() => toggleArray("cloudPresence", v)} />)}</div></fieldset>
                <fieldset className="arka-choice-panel"><legend>Security technology <span>Optional</span></legend><div className="arka-check-grid">{SECURITY_TECHNOLOGIES.map(v => <CheckChoice key={v} value={v} active={form.securityTechnologies.includes(v)} onClick={() => toggleArray("securityTechnologies", v)} />)}</div></fieldset>
              </div>}

              {step === 2 && <div className="arka-form-grid two">
                <Field label="SIEM" value={form.securityStack.siem} placeholder="Splunk, Sentinel, QRadar" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, siem: v } }))} />
                <Field label="EDR / XDR" value={form.securityStack.edrXdr} placeholder="CrowdStrike, Defender" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, edrXdr: v } }))} />
                <Field label="IAM" value={form.securityStack.iam} placeholder="Okta, Entra ID, CyberArk" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, iam: v } }))} />
                <Field label="Cloud security" value={form.securityStack.cloudSecurity} placeholder="Prisma Cloud, Wiz" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, cloudSecurity: v } }))} />
                <div className="arka-form-wide"><Field label="Other technologies / tools" value={form.securityStack.other} placeholder="Other security products or technologies" onChange={(v) => setForm((f) => ({ ...f, securityStack: { ...f.securityStack, other: v } }))} /></div>
              </div>}

              {step === 3 && <div className="arka-form-grid"><fieldset className="arka-choice-panel"><legend>Security priorities <span>Select everything that applies</span></legend><div className="arka-check-grid priorities">{PRIORITIES.map(v => <CheckChoice key={v} value={v} active={form.securityPriorities.includes(v)} onClick={() => toggleArray("securityPriorities", v)} />)}</div></fieldset></div>}

              {error && <p className="arka-form-error" role="alert">{error}</p>}
              <footer className="arka-form-footer">
                <button type="button" className="arka-back-action" onClick={async () => { if (step !== 0) { setStep(step - 1); return; } if (supabase) { setSaving(true); await supabase.auth.signOut(); } sessionStorage.setItem("arka-signed-out", "1"); navigate("/login", { replace: true }); }} disabled={saving}><ArrowLeft size={15} /> {step === 0 ? "Sign out" : "Back"}</button>
                <span>{saving ? "Saving your context…" : "Required fields are marked *"}</span>
                <button type="submit" className="arka-primary-action" disabled={!valid || saving}>{step === 3 ? "Finish setup" : "Save & continue"} <ArrowRight size={16} /></button>
              </footer>
            </motion.form>
          </div>
        </div>
      </section>
    </div>
  ), document.body);
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
