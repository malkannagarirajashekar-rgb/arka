import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Mail,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAccessContext, roleRoute } from "../lib/access";

type Mode = "login" | "signup" | "forgot";

const orbitItems = [
  { label: "IDENTITY", value: "VERIFIED", angle: -26 },
  { label: "CONTEXT", value: "BOUND", angle: 58 },
  { label: "TENANT", value: "ISOLATED", angle: 145 },
  { label: "TRACE", value: "READY", angle: 230 },
];

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "signup" : params.get("mode") === "forgot" ? "forgot" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedOutTransition, setSignedOutTransition] = useState(
    () => sessionStorage.getItem("arka-signed-out") === "1"
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const routingRef = useRef(false);

  async function routeAfterAuth() {
    if (routingRef.current) return;
    routingRef.current = true;
    try {
      if (!supabase) {
        navigate("/login", { replace: true });
        return;
      }

      // Resolve the platform flag immediately after authentication. This is a
      // deliberate fast path: an existing platform administrator must never
      // briefly enter the Tenant Admin bootstrap route because a legacy
      // profiles.role says tenant_user or because two auth events race.
      const access = await getAccessContext();
      if (!access) {
        routingRef.current = false;
        setBusy(false);
        setError("Your account was authenticated, but ARKA could not resolve its platform access yet. Please try again.");
        return;
      }
      if (access.accessState === "PENDING_TENANT_ONBOARDING") {
        navigate("/tenant", { replace: true });
        return;
      }
      if (!access.role) {
        routingRef.current = false;
        setBusy(false);
        setError("Your account is signed in, but it has not been assigned an ARKA role yet.");
        return;
      }
      if (access.role === "TENANT_ADMIN" && access.tenantId) {
        const { data, error: onboardingError } = await supabase
          .from("tenant_onboarding")
          .select("completed")
          .eq("tenant_id", access.tenantId)
          .maybeSingle();
        if (onboardingError) console.warn("Unable to read onboarding status; continuing to tenant workspace.", onboardingError);
        navigate(data?.completed ? roleRoute(access.role) : "/tenant", { replace: true });
        return;
      }
      navigate(roleRoute(access.role), { replace: true });
    } catch (e) {
      console.error("Post-login routing failed", e);
      routingRef.current = false;
      setBusy(false);
      setError(e instanceof Error ? e.message : "Signed in, but Arka could not determine your workspace.");
    }
  }

  useEffect(() => {
    setMode(initialMode);
    setMessage("");
    setError("");
  }, [initialMode]);

  useEffect(() => {
    if (!supabaseConfigured || !supabase || !signedOutTransition) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        sessionStorage.removeItem("arka-signed-out");
        setSignedOutTransition(false);
      }
    });
    return () => { mounted = false; };
  }, [signedOutTransition]);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    let mounted = true;
    async function finishOAuth() {
      const { data, error: sessionError } = await supabase!.auth.getSession();
      if (!mounted) return;
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (data.session && !sessionStorage.getItem("arka-signed-out")) routeAfterAuth();
    }
    finishOAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (!sessionStorage.getItem("arka-signed-out") && ["SIGNED_IN", "INITIAL_SESSION", "TOKEN_REFRESHED"].includes(event)) routeAfterAuth();
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage("");
    setError("");
    setPassword("");
    setConfirm("");
    navigate(next === "login" ? "/login" : `/login?mode=${next}`, { replace: true });
  }

  function validatePassword(value: string) {
    return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
  }

  async function continueWithGoogle() {
    setMessage("");
    setError("");
    if (!supabaseConfigured || !supabase) {
      setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.");
      return;
    }
    setBusy(true);
    const redirectTo = `${window.location.origin}/login`;
    try {
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { access_type: "offline", prompt: "select_account" } },
      });
      if (authError) {
        setBusy(false);
        setError(`Google sign-in failed: ${authError.message}`);
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setBusy(false);
      setError("Google sign-in did not return an authentication URL. Check that Google is enabled in Supabase Authentication → Providers.");
    } catch (oauthError) {
      setBusy(false);
      setError(oauthError instanceof Error ? `Google sign-in failed: ${oauthError.message}` : "Google sign-in failed. Please check your Supabase Google provider configuration.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!supabaseConfigured || !supabase) {
      setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.");
      return;
    }
    if (mode === "signup") {
      if (!fullName.trim()) return setError("Please enter your full name.");
      if (!validatePassword(password)) return setError("Password must be at least 8 characters and contain a letter and a number.");
      if (password !== confirm) return setError("Passwords do not match.");
    }
    if (mode !== "forgot" && !email.trim()) return setError("Please enter your email address.");
    setBusy(true);
    if (mode === "login") {
      sessionStorage.removeItem("arka-signed-out");
      setSignedOutTransition(false);
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (authError) {
        const lower = authError.message.toLowerCase();
        if (lower.includes("email not confirmed")) return setError("Your email is not verified yet. Check your inbox.");
        if (lower.includes("invalid login credentials")) return setError("Email or password is incorrect. If this account was created with Google, use the Google button instead.");
        return setError(authError.message);
      }
      await routeAfterAuth();
      return;
    }
    if (mode === "signup") {
      const redirectTo = `${window.location.origin}/login?verified=1`;
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: redirectTo },
      });
      setBusy(false);
      if (authError) return setError(authError.message);
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError("An account with this email already exists. Please sign in or use Forgot password.");
        setMode("login");
        navigate("/login", { replace: true });
        return;
      }
      if (data.session) {
        navigate("/tenant", { replace: true });
      } else {
        setMessage("Account created. Check your email to verify your account, then sign in.");
        setMode("login");
        navigate("/login", { replace: true });
      }
      return;
    }
    const redirectTo = `${window.location.origin}/login?mode=login`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (resetError) return setError(resetError.message);
    setMessage("If an account exists for that email, a password-reset link has been sent.");
  }

  const eyebrow = mode === "login" ? "RETURNING IDENTITY" : mode === "signup" ? "CREATE IDENTITY" : "ACCESS RECOVERY";
  const title = mode === "login" ? <>Enter your <em>context.</em></> : mode === "signup" ? <>Create your <em>identity.</em></> : <>Restore your <em>access.</em></>;

  return (
    <main className="arka-access-page">
      <div className="access-noise" />
      <div className="access-grid" />
      <div className="access-corner access-corner-tl" />
      <div className="access-corner access-corner-br" />

      <header className="access-header">
        <Brand className="access-brand" />
        <div className="access-header-right">
          <span className="access-live"><i /> ARKA IDENTITY SYSTEM</span>
          <ThemeToggle />
        </div>
      </header>

      <Link className="access-back" to="/"><ArrowLeft size={15} /> Back to Arka</Link>

      <div className="access-layout">
        <section className="access-intro">
          <div className="access-kicker"><span /> SECURE ACCESS / {mode === "login" ? "01" : mode === "signup" ? "02" : "03"}</div>
          <h1>Security<br /><span>needs</span><br />context<span>.</span></h1>
          <p className="access-description">Arka connects identity, people, systems and signals before revealing the workspace behind them.</p>

          <div className="access-orbit-wrap" aria-hidden="true">
            <motion.div className="access-orbit access-orbit-one" animate={{ rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }} />
            <motion.div className="access-orbit access-orbit-two" animate={{ rotate: -360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} />
            <motion.div className="access-orbit access-orbit-three" animate={{ rotate: 360 }} transition={{ duration: 42, repeat: Infinity, ease: "linear" }} />
            {orbitItems.map((item) => (
              <motion.div
                key={item.label}
                className="access-orbit-label"
                style={{ "--angle": `${item.angle}deg` } as React.CSSProperties}
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, delay: item.angle / 100, ease: "easeInOut" }}
              >
                <small>{item.label}</small><strong>{item.value}</strong>
              </motion.div>
            ))}
            <motion.div className="access-core" animate={{ scale: [1, 1.04, 1], boxShadow: ["0 0 0 0 rgba(99,207,255,.0)", "0 0 0 18px rgba(99,207,255,.08)", "0 0 0 0 rgba(99,207,255,.0)"] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}>
              <Fingerprint size={31} strokeWidth={1.25} />
              <span>ARKA</span>
            </motion.div>
            <motion.div className="access-scan" animate={{ rotate: 360 }} transition={{ duration: 7, repeat: Infinity, ease: "linear" }}><ScanLine size={16} /></motion.div>
          </div>

          <div className="access-metrics">
            <div><span>01</span><strong>IDENTITY</strong><small>verified first</small></div>
            <div><span>02</span><strong>CONTEXT</strong><small>bound to tenant</small></div>
            <div><span>03</span><strong>TRACE</strong><small>ready to follow</small></div>
          </div>
        </section>

        <motion.section className="access-panel" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, ease: [0.22, 1, 0.36, 1] }} key={mode}>
          <div className="access-panel-top">
            <div><span className="panel-dot" /> GATE / {mode === "login" ? "01" : mode === "signup" ? "02" : "03"}</div>
            <span>SECURE CHANNEL</span>
          </div>

          <div className="access-panel-heading">
            <div className="access-panel-icon"><ShieldCheck size={20} /></div>
            <div><small>{eyebrow}</small><h2>{title}</h2></div>
          </div>
          <p className="access-panel-subtitle">{mode === "login" ? "Continue to your protected organization workspace." : mode === "signup" ? "Establish the identity Arka will use to build your context." : "We'll send a secure link to restore your identity."}</p>

          <form onSubmit={submit} className="access-form">
            {mode === "signup" && <label>Full name<div className="access-field"><Activity size={17} /><input value={fullName} onChange={(e) => setFullName(e.target.value)} type="text" placeholder="Your full name" autoComplete="name" required /></div></label>}
            <label>Email<div className="access-field"><Mail size={17} /><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@company.com" autoComplete="email" required /></div></label>
            {mode !== "forgot" && <label>Password<div className="access-field"><LockKeyhole size={17} /><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} required /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{mode === "signup" && <small>8+ characters · letter + number</small>}</label>}
            {mode === "signup" && <label>Confirm password<div className="access-field"><LockKeyhole size={17} /><input value={confirm} onChange={(e) => setConfirm(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••••" autoComplete="new-password" required /></div></label>}

            {mode === "login" && <button type="button" className="access-forgot" onClick={() => switchMode("forgot")}>Forgot password?</button>}
            {error && <p className="access-message access-error" role="alert">{error}</p>}
            {message && <p className="access-message access-success" role="status"><CheckCircle2 size={14} /> {message}</p>}

            <motion.button type="submit" className="access-submit" disabled={busy} whileHover={{ x: 4 }} whileTap={{ scale: .985 }}>
              <span>{busy ? "Securing channel…" : mode === "login" ? "Enter Arka" : mode === "signup" ? "Create identity" : "Send reset link"}</span><ArrowRight size={18} />
            </motion.button>
          </form>

          {(mode === "login" || mode === "signup") && <>
            <div className="access-or"><span /> <b>OR CONTINUE WITH</b> <span /></div>
            <button type="button" className="access-google" onClick={(event) => { event.preventDefault(); void continueWithGoogle(); }} disabled={busy}><b>G</b><span>{busy ? "Connecting…" : "Google"}</span><ArrowRight size={15} /></button>
          </>}

          <div className="access-switch">
            {mode === "login" && <>New to Arka? <button type="button" onClick={() => switchMode("signup")}>Create account</button></>}
            {mode === "signup" && <>Already have an identity? <button type="button" onClick={() => switchMode("login")}>Sign in</button></>}
            {mode === "forgot" && <>Remembered your password? <button type="button" onClick={() => switchMode("login")}>Return to sign in</button></>}
          </div>

          <div className="access-footnote"><LockKeyhole size={14} /><span>Supabase handles authentication. Organization context remains behind the tenant identity boundary.</span></div>
        </motion.section>
      </div>

      <footer className="access-footer"><span>ARKA / SECURITY INTELLIGENCE</span><span><i /> ENCRYPTED ENTRY</span><span>GATE {mode === "login" ? "01" : mode === "signup" ? "02" : "03"}</span></footer>
    </main>
  );
}
