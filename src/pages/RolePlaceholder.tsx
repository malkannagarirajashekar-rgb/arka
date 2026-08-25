import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Brand } from "../components/Brand";

export default function RolePlaceholder({ role }: { role: "tenant_admin" | "tenant_user" }) {
  const title = role === "tenant_admin" ? "Tenant Admin" : "Tenant User";
  return (
    <main className="auth-loading">
      <Brand />
      <div className="placeholder-card">
        <ShieldCheck size={28} />
        <p className="eyebrow"><span /> ACCESS VERIFIED</p>
        <h1>{title}</h1>
        <p>Your account is authenticated. This role-specific workspace will be implemented in the next platform phase.</p>
        <Link className="button button-primary" to="/">Return to website <ArrowLeft size={16}/></Link>
      </div>
    </main>
  );
}
