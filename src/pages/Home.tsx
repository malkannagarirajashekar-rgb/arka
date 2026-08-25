import { motion } from "motion/react";
import { ArrowDown, ArrowRight, CheckCircle2, GitBranch, Layers3, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { Mandala } from "../components/Mandala";
import { PublicNav } from "../components/PublicNav";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.7, ease: "easeOut" },
};

export default function Home() {
  return (
    <div className="site">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <PublicNav />

      <main>
        <section className="hero section-shell">
          <motion.div className="hero-copy" initial={{ opacity: 0, x: -25 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <p className="eyebrow"><span /> INTELLIGENT SECURITY · MODERN INDIA</p>
            <h1>Secure today.<br /><em>Control tomorrow.</em></h1>
            <p className="hero-lead">A centralized operating platform for tenants, users, applications and integrations — built around security, visibility and control.</p>
            <div className="hero-buttons">
              <Link className="button button-primary" to="/login">Enter Platform <ArrowRight size={16} /></Link>
              <a className="button button-ghost" href="#architecture">Explore architecture <ArrowDown size={16} /></a>
            </div>
            <div className="trust-line">
              <span><CheckCircle2 size={13} /> Multi-tenant</span>
              <span><CheckCircle2 size={13} /> Role-based</span>
              <span><CheckCircle2 size={13} /> Audit-ready</span>
              <span><CheckCircle2 size={13} /> Docker-first</span>
            </div>
          </motion.div>
          <motion.div className="hero-art" initial={{ opacity: 0, scale: .88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, delay: .15 }}>
            <Mandala />
          </motion.div>
        </section>

        <motion.section id="architecture" className="section-shell section-border" {...fadeUp}>
          <div className="section-heading">
            <p className="eyebrow"><span /> THE FIRST LAYER</p>
            <h2>One system.<br /><em>Clear hierarchy.</em></h2>
            <p>We establish the security and ownership model first. Every future module sits on this foundation.</p>
          </div>
          <div className="hierarchy-grid">
            <Role icon={<ShieldCheck />} index="01" title="Super Admin" text="Global control across the entire ecosystem." tags={["Tenants", "Users", "Apps", "Global"]} featured />
            <div className="connector">→</div>
            <Role icon={<Users />} index="02" title="Tenant Admin" text="Manage one organization and its resources." tags={["Users", "Apps", "Permissions"]} />
            <div className="connector">→</div>
            <Role icon={<Layers3 />} index="03" title="Tenant User" text="Access only assigned applications and resources." tags={["Apps", "Profile", "Access"]} />
          </div>
        </motion.section>

        <motion.section id="solutions" className="section-shell" {...fadeUp}>
          <div className="section-heading split">
            <div><p className="eyebrow"><span /> PLATFORM FOUNDATION</p><h2>Built for scale.<br /><em>Designed for control.</em></h2></div>
            <p>Each module is independent enough to evolve and connected enough to operate as one platform.</p>
          </div>
          <div className="feature-grid">
            <Feature n="01" icon={<Users />} title="Tenant Management" text="Create, configure and monitor organizations from a unified global view." />
            <Feature n="02" icon={<ShieldCheck />} title="Identity & Access" text="Role-based access with clear ownership and least privilege." />
            <Feature n="03" icon={<Layers3 />} title="Apps Module" text="Connect applications to tenants and control who can use them." />
            <Feature n="04" icon={<GitBranch />} title="Integration Layer" text="Foundation for agents, Git operations and future deployment workflows." />
          </div>
        </motion.section>

        <motion.section id="platform" className="section-shell platform-section" {...fadeUp}>
          <div className="platform-copy">
            <p className="eyebrow"><span /> GLOBAL ADMIN SYSTEM</p>
            <h2>Visibility without<br /><em>complexity.</em></h2>
            <p>The authenticated platform begins with a focused Super Admin workspace and expands into the full tenant and application ecosystem.</p>
            <Link className="button button-primary" to="/login">Open platform <ArrowRight size={16} /></Link>
          </div>
          <div className="dashboard-mock">
            <div className="dash-bar"><strong>Super Admin</strong><span><i /> All systems operational</span></div>
            <div className="metric-grid">
              <Metric label="Tenants" value="24" change="+12%" />
              <Metric label="Users" value="1,248" change="+18%" />
              <Metric label="Active Apps" value="36" change="+8%" />
              <Metric label="System Health" value="99.9%" change="Healthy" good />
            </div>
            <div className="chart">
              <div className="chart-title">Platform activity <span>LAST 24 HOURS</span></div>
              <div className="bars">{[30,55,42,74,58,88,70,94,62,82,68,96].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
            </div>
          </div>
        </motion.section>

        <motion.section className="onboarding-strip section-shell" {...fadeUp}>
          <div>
            <p className="eyebrow"><span /> NEW TO TRINETRA</p>
            <h2>Start with a secure identity.</h2>
            <p>Create your account now. Organization access can be assigned later by an authorized administrator.</p>
          </div>
          <Link className="button button-outline" to="/login?mode=signup">Create account <ArrowRight size={16} /></Link>
        </motion.section>

        <motion.section id="about" className="quote section-shell" {...fadeUp}>
          <span className="quote-mark">“</span>
          <blockquote>Secure. Centralized. Simplified.</blockquote>
          <p>Technology should make control clearer — not harder.</p>
          <small>Indian systems of order, translated into modern technology.</small>
        </motion.section>
      </main>

      <footer className="footer">
        <div><Brand /><p>Secure, scalable and intelligent systems for the modern enterprise.</p></div>
        <div><h4>Platform</h4><a href="#architecture">Architecture</a><a href="#solutions">Solutions</a><a href="#platform">Admin System</a></div>
        <div><h4>Company</h4><a href="#about">About</a><Link to="/login">Sign in</Link></div>
        <div><h4>Next</h4><p>Foundation today. Full platform tomorrow.</p></div>
      </footer>
    </div>
  );
}

function Role({ icon, index, title, text, tags, featured = false }: { icon: React.ReactNode; index: string; title: string; text: string; tags: string[]; featured?: boolean }) {
  return <div className={`role-card ${featured ? "featured" : ""}`}><span className="role-index">{index}</span><div className="role-icon">{icon}</div><h3>{title}</h3><p>{text}</p><div className="tags">{tags.map(t => <span key={t}>{t}</span>)}</div></div>;
}
function Feature({ n, icon, title, text }: { n: string; icon: React.ReactNode; title: string; text: string }) {
  return <article className="feature-card"><span className="feature-number">{n}</span><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>;
}
function Metric({ label, value, change, good = false }: { label: string; value: string; change: string; good?: boolean }) {
  return <div className="metric"><small>{label}</small><strong>{value}</strong><span className={good ? "good" : ""}>{change}</span></div>;
}
