import { motion } from "motion/react";
import { ArrowDown, ArrowRight, CheckCircle2, GitBranch, Layers3, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { Mandala } from "../components/Mandala";
import { PublicNav } from "../components/PublicNav";

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 }, transition: { duration: 0.65, ease: "easeOut" } };

export default function Home() {
  return (
    <div className="site">
      <div className="ambient ambient-a" /><div className="ambient ambient-b" /><div className="grain" />
      <PublicNav />
      <main>
        <section className="hero section-shell">
          <motion.div className="hero-copy" initial={{ opacity: 0, x: -25 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .8 }}>
            <p className="eyebrow"><span /> INTELLIGENT SECURITY · MODERN INDIA</p>
            <h1>See clearly.<br /><em>Act decisively.</em></h1>
            <p className="hero-lead">Arka is a centralized security operations platform for identities, applications, integrations and teams — bringing visibility and control into one system.</p>
            <div className="hero-buttons"><Link className="button button-primary" to="/login">Enter Arka <ArrowRight size={16} /></Link><a className="button button-ghost" href="#architecture">Explore platform <ArrowDown size={16} /></a></div>
            <div className="trust-line"><span><CheckCircle2 size={13}/> Multi-tenant</span><span><CheckCircle2 size={13}/> Role-based</span><span><CheckCircle2 size={13}/> Audit-ready</span><span><CheckCircle2 size={13}/> Deployment-ready</span></div>
          </motion.div>
          <motion.div className="hero-art" initial={{ opacity: 0, scale: .88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, delay: .15 }}><Mandala /></motion.div>
        </section>

        <motion.section id="architecture" className="section-shell section-border" {...fadeUp}>
          <div className="section-heading"><p className="eyebrow"><span /> SECURITY ARCHITECTURE</p><h2>One system.<br /><em>Every layer connected.</em></h2><p>Arka starts with a clear ownership model, then connects identities, applications and integrations without losing context.</p></div>
          <div className="hierarchy-grid"><Role icon={<ShieldCheck/>} index="01" title="Control" text="Global policy, visibility and governance across the environment." tags={["Tenants","Policies","Audit"]} featured/><div className="connector">→</div><Role icon={<Users/>} index="02" title="Identity" text="Manage people, roles and access with explicit boundaries." tags={["Users","Roles","Access"]}/><div className="connector">→</div><Role icon={<Layers3/>} index="03" title="Resources" text="Connect applications and services to the right teams." tags={["Apps","Services","Scopes"]}/></div>
        </motion.section>

        <motion.section id="solutions" className="section-shell" {...fadeUp}>
          <div className="section-heading split"><div><p className="eyebrow"><span /> PLATFORM FOUNDATION</p><h2>Built around the<br /><em>signal, not the noise.</em></h2></div><p>Every Arka module is independently useful and designed to operate as part of one security control plane.</p></div>
          <div className="feature-grid"><Feature n="01" icon={<Users/>} title="Identity fabric" text="Centralize users, roles and ownership with clear access boundaries."/><Feature n="02" icon={<ShieldCheck/>} title="Policy control" text="Define who can access what, and keep every important action accountable."/><Feature n="03" icon={<Layers3/>} title="Application layer" text="Connect internal applications and services to governed environments."/><Feature n="04" icon={<GitBranch/>} title="Integration mesh" text="Create a foundation for agents, repositories, deployments and automation."/></div>
        </motion.section>

        <motion.section id="platform" className="section-shell platform-section" {...fadeUp}>
          <div className="platform-copy"><p className="eyebrow"><span /> SECURITY CONTROL PLANE</p><h2>Visibility without<br /><em>the clutter.</em></h2><p>The authenticated workspace turns the architecture into an operational system — with clear metrics, health signals and actionable control.</p><Link className="button button-primary" to="/login">Open platform <ArrowRight size={16}/></Link></div>
          <div className="dashboard-mock"><div className="dash-bar"><strong>Arka / Overview</strong><span><i/> Systems nominal</span></div><div className="metric-grid"><Metric label="Tenants" value="24" change="+12%"/><Metric label="Identities" value="1,248" change="+18%"/><Metric label="Services" value="36" change="+8%"/><Metric label="Health" value="99.9%" change="Stable" good/></div><div className="chart"><div className="chart-title">Security activity <span>LAST 24 HOURS</span></div><div className="bars">{[30,55,42,74,58,88,70,94,62,82,68,96].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></div></div>
        </motion.section>

        <motion.section className="onboarding-strip section-shell" {...fadeUp}><div><p className="eyebrow"><span/> READY WHEN YOU ARE</p><h2>Start with a secure identity.</h2><p>Create an account and let an authorized administrator assign your organization access.</p></div><Link className="button button-outline" to="/login?mode=signup">Create account <ArrowRight size={16}/></Link></motion.section>
        <motion.section id="about" className="quote section-shell" {...fadeUp}><span className="quote-mark">✦</span><blockquote>Clarity is a security feature.</blockquote><p>Arka turns complex environments into systems people can actually understand and control.</p><small>Observe. Protect. Respond. Control.</small></motion.section>
      </main>
      <footer className="footer"><div><Brand/><p>Security systems designed for clarity, scale and control.</p></div><div><h4>Platform</h4><a href="#architecture">Architecture</a><a href="#solutions">Solutions</a><a href="#platform">Control plane</a></div><div><h4>Company</h4><a href="#about">About</a><Link to="/login">Sign in</Link></div><div><h4>Principle</h4><p>Make the signal impossible to miss.</p></div></footer>
    </div>
  );
}
function Role({icon,index,title,text,tags,featured=false}:{icon:React.ReactNode;index:string;title:string;text:string;tags:string[];featured?:boolean}){return <div className={`role-card ${featured?"featured":""}`}><span className="role-index">{index}</span><div className="role-icon">{icon}</div><h3>{title}</h3><p>{text}</p><div className="tags">{tags.map(t=><span key={t}>{t}</span>)}</div></div>}
function Feature({n,icon,title,text}:{n:string;icon:React.ReactNode;title:string;text:string}){return <article className="feature-card"><span className="feature-number">{n}</span><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>}
function Metric({label,value,change,good=false}:{label:string;value:string;change:string;good?:boolean}){return <div className="metric"><small>{label}</small><strong>{value}</strong><span className={good?"good":""}>{change}</span></div>}
