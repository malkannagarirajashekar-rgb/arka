import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers3,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { Brand } from "../components/Brand";
import { ThemeToggle } from "../components/ThemeToggle";
import { supabase, supabaseConfigured } from "../lib/supabase";

type Mode = "login" | "signup" | "forgot";

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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setMode(initialMode);
    setMessage("");
    setError("");
  }, [initialMode]);

  // Supabase is configured to return OAuth sessions to /login. Once the
  // browser session exists, send the user through the normal role-aware
  // /admin -> /app routing already used by password authentication.
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
      if (data.session) navigate("/admin", { replace: true });
    }

    finishOAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session && ["SIGNED_IN", "INITIAL_SESSION", "TOKEN_REFRESHED"].includes(event)) {
        navigate("/admin", { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (authError) {
        setBusy(false);
        setError(`Google sign-in failed: ${authError.message}`);
        return;
      }

      // Supabase normally redirects automatically. Explicitly navigating to
      // the returned OAuth URL makes the action reliable across browsers and
      // avoids a silent no-op if the client cannot perform the navigation.
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
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (authError) {
        const lower = authError.message.toLowerCase();
        if (lower.includes("email not confirmed")) return setError("Your email is not verified yet. Check your inbox.");
        if (lower.includes("invalid login credentials")) return setError("Email or password is incorrect.");
        return setError(authError.message);
      }
      navigate("/admin", { replace: true });
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
        navigate("/admin", { replace: true });
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

  const eyebrow = mode === "login" ? "WELCOME BACK" : mode === "signup" ? "NEW SECURE IDENTITY" : "RECOVER ACCESS";
  const title = mode === "login" ? <>Sign in to <em>Arka</em></> : mode === "signup" ? <>Create your <em>identity</em></> : <>Restore your <em>access</em></>;

  return (
    <main className="arka-login">
      <div className="login-bg login-blue" />
      <div className="login-bg login-violet" />
      <div className="login-bg login-pink" />
      <div className="login-noise" />

      <Link className="back-website" to="/">
        <ArrowLeft size={17} />
        <span>Back to website</span>
      </Link>

      <div className="login-orbit-field" aria-hidden="true">
        <div className="login-orbit orbit-1" />
        <div className="login-orbit orbit-2" />
        <div className="login-orbit orbit-3" />
        <div className="login-orbit orbit-4" />
        <i className="login-orbit-point point-a" />
        <i className="login-orbit-point point-b" />
        <i className="login-orbit-point point-c" />
        <div className="login-orbit-core">
          <img src="/brand/arka-logo-transparent.png" alt="" />
        </div>
      </div>

      <div className="login-layout">
        <section className="login-brand-side">
          <Brand />
          <div className="login-side-kicker"><span /> INTELLIGENCE. CONTROL. PROTECTION.</div>

          <motion.div className="login-copy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1>Security,<br /><em>reimagined.</em></h1>
            <p>Arka unifies identity, applications, and data into one secure control plane.</p>
          </motion.div>

          <div className="login-features">
            <Feature icon={<ShieldCheck />} title="Zero Trust" sub="Architecture" />
            <Feature icon={<Layers3 />} title="Unified" sub="Visibility" />
            <Feature icon={<Zap />} title="Real-time" sub="Response" />
          </div>

          <div className="login-planet" aria-hidden="true">
            <div className="planet-glow" />
            <div className="planet-grid" />
          </div>
        </section>

        <motion.form
          className="login-card"
          onSubmit={submit}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          key={mode}
        >
          <div className="login-card-top">
            <div className="login-shield"><ShieldCheck size={24} /></div>
            <ThemeToggle />
          </div>

          <div className="login-eyebrow"><span /> {eyebrow}</div>
          <h2>{title}</h2>
          <p className="login-subtitle">
            {mode === "login" ? "Access your secure workspace" : mode === "signup" ? "Create your secure workspace identity" : "Enter your email to regain access"}
          </p>

          {mode === "signup" && (
            <label>Full name
              <div className="field-shell">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} type="text" placeholder="Your full name" autoComplete="name" required />
              </div>
            </label>
          )}

          <label>Email
            <div className="field-shell field-with-icon">
              <Mail className="field-icon" size={19} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@company.com" autoComplete="email" required />
            </div>
          </label>

          {mode !== "forgot" && (
            <label>Password
              <div className="field-shell password-field field-with-icon">
                <LockKeyhole className="field-icon" size={19} />
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {mode === "signup" && <small>8+ characters · letter + number</small>}
            </label>
          )}

          {mode === "signup" && (
            <label>Confirm password
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••••" autoComplete="new-password" required />
            </label>
          )}

          {mode === "login" && <button type="button" className="forgot-link" onClick={() => switchMode("forgot")}>Forgot password?</button>}
          {error && <p className="login-error" role="alert">{error}</p>}
          {message && <p className="login-success" role="status"><CheckCircle2 size={14} /> {message}</p>}

          <button className="login-submit" disabled={busy}>
            {busy ? "Securing session…" : mode === "login" ? <>Sign in <ArrowRight size={19} /></> : mode === "signup" ? <>Create account <ArrowRight size={19} /></> : <>Send reset link <ArrowRight size={19} /></>}
          </button>

          <div className="login-divider"><span /> OR <span /></div>
          {(mode === "login" || mode === "signup") && (
            <button
              type="button"
              className="google-button"
              onClick={(event) => {
                event.preventDefault();
                void continueWithGoogle();
              }}
              disabled={busy}
            >
              <b>G</b> {busy ? "Connecting…" : "Continue with Google"}
            </button>
          )}

          <div className="auth-switch">
            {mode === "login" && <>Don’t have an account? <button type="button" onClick={() => switchMode("signup")}>Create account</button></>}
            {mode === "signup" && <>Already have an account? <button type="button" onClick={() => switchMode("login")}>Sign in</button></>}
            {mode === "forgot" && <>Remember your password? <button type="button" onClick={() => switchMode("login")}>Sign in</button></>}
          </div>

          <div className="supabase-note">
            <LockKeyhole size={17} />
            <span>Authentication is handled by Supabase. New public accounts start as tenant users until assigned to an organization by an authorized administrator.</span>
          </div>
        </motion.form>
      </div>
    </main>
  );
}

function Feature({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return <div className="login-feature"><div>{icon}</div><strong>{title}</strong><span>{sub}</span></div>;
}
