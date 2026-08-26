import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
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

  async function submit(e: FormEvent) {
    e.preventDefault();
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("email not confirmed")) {
          return setError("Your email is not verified yet. Check your inbox or use the verification email again.");
        }
        if (message.includes("invalid login credentials")) {
          return setError("Email or password is incorrect.");
        }
        return setError(error.message);
      }
      navigate("/admin");
      return;
    }

    if (mode === "signup") {
      const redirectTo = `${window.location.origin}/login?verified=1`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: redirectTo },
      });
      setBusy(false);

      if (error) return setError(error.message);

      // Supabase intentionally obfuscates whether an email already exists when
      // email confirmation is enabled. A returned user with no identities is
      // the reliable client-side signal that the email is already registered.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError("An account with this email already exists. Please sign in instead, or use Forgot password.");
        setMode("login");
        navigate("/login", { replace: true });
        return;
      }

      // If email confirmation is disabled, a session may be returned immediately.
      if (data.session) {
        navigate("/admin");
      } else {
        setMessage("Account created. Check your email to verify your account, then sign in.");
        setMode("login");
        navigate("/login", { replace: true });
      }
      return;
    }

    const redirectTo = `${window.location.origin}/login?mode=login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (error) return setError(error.message);
    setMessage("If an account exists for that email, a password-reset link has been sent.");
  }

  const title = mode === "login" ? <>Welcome <em>back.</em></> : mode === "signup" ? <>Create your <em>account.</em></> : <>Reset your <em>password.</em></>;
  const eyebrow = mode === "login" ? "PLATFORM LOGIN" : mode === "signup" ? "CREATE ACCOUNT" : "ACCOUNT RECOVERY";

  return (
    <main className="auth">
      <Link className="back-link" to="/"><ArrowLeft size={14}/> Back to Sarv</Link>

      <div className="auth-brand">
        <Brand />
        <p className="eyebrow"><span /> SECURE ACCESS</p>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={mode}>
          {title}
        </motion.h1>
        <p>
          {mode === "login" && "Sign in to the connected administration platform."}
          {mode === "signup" && "Create your account and begin your secure journey."}
          {mode === "forgot" && "Enter your email and we'll send instructions to reset your password."}
        </p>
        <div className="auth-orbit"><div /><b>ॐ</b></div>
      </div>

      <motion.form className="login-card" onSubmit={submit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={mode}>
        <div className="login-top"><p className="eyebrow"><span /> {eyebrow}</p><ThemeToggle /></div>
        <h2>{mode === "login" ? "Welcome back." : mode === "signup" ? "Let's begin." : "Recover access."}</h2>
        <p className="muted">
          {mode === "login" ? "Use your organization credentials to continue." :
           mode === "signup" ? "Use your work identity to create an account." :
           "We'll help you securely regain access."}
        </p>

        {mode === "signup" && (
          <label>Full name
            <input value={fullName} onChange={e => setFullName(e.target.value)} type="text" placeholder="Your full name" autoComplete="name" required />
          </label>
        )}

        <label>Email
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@company.com" autoComplete="email" required />
        </label>

        {mode !== "forgot" && (
          <label>Password
            <div className="password-field">
              <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
              <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {mode === "signup" && <small className="password-help">8+ characters · at least one letter · at least one number</small>}
          </label>
        )}

        {mode === "signup" && (
          <label>Confirm password
            <input value={confirm} onChange={e => setConfirm(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="new-password" required />
          </label>
        )}

        {mode === "login" && (
          <button type="button" className="forgot-link" onClick={() => switchMode("forgot")}>Forgot password?</button>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status"><CheckCircle2 size={14}/> {message}</p>}

        <button className="button button-primary full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? <>Sign in <ArrowRight size={16}/></> : mode === "signup" ? <>Create account <ArrowRight size={16}/></> : <>Send reset link <ArrowRight size={16}/></>}
        </button>

        <div className="auth-switch">
          {mode === "login" && <>Don't have an account? <button type="button" onClick={() => switchMode("signup")}>Create account</button></>}
          {mode === "signup" && <>Already have an account? <button type="button" onClick={() => switchMode("login")}>Sign in</button></>}
          {mode === "forgot" && <>Remember your password? <button type="button" onClick={() => switchMode("login")}>Sign in</button></>}
        </div>

        <small className="security-note">Authentication is handled by Supabase. New public accounts start as tenant users until assigned to an organization by an authorized administrator.</small>
      </motion.form>
    </main>
  );
}
