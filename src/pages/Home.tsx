import { motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Fingerprint,
  Layers3,
  LockKeyhole,
  Network,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { PublicNav } from "../components/PublicNav";

type Layer = "identity" | "applications" | "policy" | "response";

const layers: Record<Layer, {
  number: string;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  accent: string;
  icon: typeof Fingerprint;
  events: string[];
}> = {
  identity: {
    number: "01",
    title: "Identity fabric",
    description: "Understand who is acting, what they can reach, and why access exists.",
    metric: "1,248",
    metricLabel: "active identities",
    accent: "cyan",
    icon: Fingerprint,
    events: ["Admin session verified", "Contractor access reviewed", "Role boundary changed"],
  },
  applications: {
    number: "02",
    title: "Application mesh",
    description: "See the services, integrations and dependencies behind every access path.",
    metric: "36",
    metricLabel: "protected apps",
    accent: "violet",
    icon: Network,
    events: ["SaaS connection healthy", "New integration detected", "Service dependency mapped"],
  },
  policy: {
    number: "03",
    title: "Policy intelligence",
    description: "Turn rules into visible decisions with ownership and context attached.",
    metric: "98.7",
    metricLabel: "security posture",
    accent: "pink",
    icon: ShieldCheck,
    events: ["Boundary evaluated", "Policy exception resolved", "Least-privilege rule applied"],
  },
  response: {
    number: "04",
    title: "Response layer",
    description: "Move from signal to accountable action without losing the trail.",
    metric: "04",
    metricLabel: "open signals",
    accent: "orange",
    icon: Zap,
    events: ["Risk signal triaged", "Owner assigned", "Response action queued"],
  },
};

const layerOrder: Layer[] = ["identity", "applications", "policy", "response"];

export default function Home() {
  const [activeLayer, setActiveLayer] = useState<Layer>("identity");
  const [scanning, setScanning] = useState(false);
  const active = layers[activeLayer];
  const ActiveIcon = active.icon;

  function runScan() {
    if (scanning) return;
    setScanning(true);
    window.setTimeout(() => setScanning(false), 1800);
  }

  return (
    <div className="arka-site home-refresh">
      <div className="home-ambient home-ambient-a" />
      <div className="home-ambient home-ambient-b" />
      <div className="home-ambient home-ambient-c" />
      <div className="arka-noise" />
      <PublicNav />

      <main>
        <section className="home-hero shell">
          <div className="hero-intro">
            <motion.div
              className="hero-kicker"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span /> 01 / CONTROL PLANE
            </motion.div>
            <motion.div
              className="hero-title-wrap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: .05, duration: .6 }}
            >
              <h1>Security that<br /><em>moves with you.</em></h1>
              <p>Arka turns identity, applications, policy and response into one interactive security system — not another dashboard to babysit.</p>
            </motion.div>
            <div className="hero-actions">
              <Link className="gradient-button" to="/login">Enter Arka <ArrowRight size={16} /></Link>
              <a className="quiet-action" href="#control">Explore the control plane <ChevronRight size={15} /></a>
            </div>
          </div>

          <motion.div
            className="command-deck"
            id="control"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: .16, duration: .7 }}
          >
            <div className="deck-topline">
              <div><span className="live-dot" /> ARKA / LIVE CONTROL PLANE</div>
              <button onClick={runScan} className={`scan-button ${scanning ? "is-scanning" : ""}`}>
                <Play size={11} fill="currentColor" /> {scanning ? "SCANNING" : "RUN CHECK"}
              </button>
            </div>

            <div className="deck-main">
              <div className="layer-rail">
                <div className="rail-label">SECURITY LAYERS</div>
                {layerOrder.map((key) => {
                  const item = layers[key];
                  const Icon = item.icon;
                  return (
                    <button
                      key={key}
                      className={`layer-tab ${activeLayer === key ? "active" : ""}`}
                      onClick={() => setActiveLayer(key)}
                    >
                      <span className={`tab-icon ${item.accent}`}><Icon size={17} /></span>
                      <span className="tab-copy"><small>{item.number}</small><strong>{item.title}</strong></span>
                      <ChevronRight size={14} />
                    </button>
                  );
                })}
              </div>

              <div className={`layer-stage ${active.accent}`}>
                <div className="stage-grid" />
                <div className="stage-top">
                  <div className="stage-status"><span /> VERIFIED / LIVE</div>
                  <span>{active.number} / 04</span>
                </div>
                <div className="stage-center">
                  <div className="signal-core">
                    <div className="signal-core-ring" />
                    <div className="signal-core-ring second" />
                    <ActiveIcon size={29} />
                  </div>
                  <div>
                    <div className="stage-overline">CURRENT LAYER</div>
                    <h2>{active.title}</h2>
                    <p>{active.description}</p>
                  </div>
                </div>
                <div className="stage-metric">
                  <strong>{active.metric}</strong>
                  <span>{active.metricLabel}</span>
                </div>
                <div className="stage-feed">
                  {active.events.map((event, i) => (
                    <div key={event} className="feed-item">
                      <span className={i === 0 ? "pulse" : ""}>{i === 0 ? "●" : "—"}</span>
                      <b>{event}</b>
                      <small>{i === 0 ? "now" : `${(i + 1) * 4}m`}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="deck-footer">
              <div><Activity size={13} /> Signal stream <b>nominal</b></div>
              <div className="deck-progress"><span /><span /><span /><span /></div>
              <div>Last check <b>just now</b></div>
            </div>
          </motion.div>
        </section>

        <section className="signal-strip shell">
          <div className="strip-item"><span>01</span><b>Identity</b><small>WHO</small></div>
          <div className="strip-line" />
          <div className="strip-item"><span>02</span><b>Applications</b><small>WHERE</small></div>
          <div className="strip-line" />
          <div className="strip-item"><span>03</span><b>Policy</b><small>WHY</small></div>
          <div className="strip-line" />
          <div className="strip-item"><span>04</span><b>Response</b><small>WHAT NEXT</small></div>
        </section>

        <section className="interactive-section shell" id="system">
          <div className="section-rule" />
          <div className="section-kicker"><span /> 02 / SYSTEM MODEL</div>
          <div className="interactive-head">
            <div><h2>Don't watch security.<br /><em>Operate it.</em></h2></div>
            <p>Select a layer to see how context travels through Arka. The interface itself becomes the explanation — every state has an owner, reason and next action.</p>
          </div>

          <div className="model-grid">
            <div className="model-stack">
              {layerOrder.map((key, index) => {
                const item = layers[key];
                const Icon = item.icon;
                return (
                  <button key={key} className={`model-card ${activeLayer === key ? "selected" : ""}`} onClick={() => setActiveLayer(key)}>
                    <span className={`model-number ${item.accent}`}>{item.number}</span>
                    <span className="model-icon"><Icon size={18} /></span>
                    <span className="model-text"><b>{item.title}</b><small>{item.description}</small></span>
                    <span className="model-arrow">{activeLayer === key ? <Check size={15} /> : <ArrowUpRight size={15} />}</span>
                    {index < 3 && <span className="model-connector" />}
                  </button>
                );
              })}
            </div>

            <div className="decision-panel">
              <div className="decision-header"><span>DECISION TRACE</span><b><span /> {active.title}</b></div>
              <div className="decision-title"><Sparkles size={18} /><div><small>CONTEXT ASSEMBLED</small><h3>One signal. Full context.</h3></div></div>
              <div className="decision-flow">
                <Flow label="Identity" value="Verified" />
                <Flow label="Application" value="Known" />
                <Flow label="Policy" value="Allowed" />
                <Flow label="Action" value="Recorded" />
              </div>
              <div className="decision-footer"><span>Decision confidence</span><strong>99.2%</strong><div className="confidence"><i /></div></div>
            </div>
          </div>
        </section>

        <section className="proof-section shell" id="architecture">
          <div className="proof-copy">
            <div className="section-kicker"><span /> 03 / WHY ARKA</div>
            <h2>Less chasing.<br /><em>More certainty.</em></h2>
            <p>Security teams shouldn't reconstruct an incident across six products. Arka keeps the relationship between people, systems, rules and actions visible in one place.</p>
            <div className="proof-list">
              <Proof icon={<Fingerprint />} title="Trace every identity" text="Know who has access and where it travels." />
              <Proof icon={<Layers3 />} title="Connect every application" text="Keep dependencies and integrations in context." />
              <Proof icon={<LockKeyhole />} title="Prove every decision" text="Make policy outcomes explainable and auditable." />
            </div>
          </div>
          <div className="signal-board">
            <div className="board-header"><span>ARKA / SIGNAL BOARD</span><b><i /> SYSTEM NOMINAL</b></div>
            <div className="board-canvas">
              <div className="board-column"><small>IDENTITY</small><div className="board-pill"><span /> Admin / verified</div><div className="board-pill"><span /> Analyst / active</div><div className="board-pill muted"><span /> Vendor / restricted</div></div>
              <div className="board-column middle"><small>POLICY ENGINE</small><div className="policy-chip">ACCESS CHECK <b>PASS</b></div><div className="policy-chip">DEVICE TRUST <b>PASS</b></div><div className="policy-chip">RISK SCORE <b>LOW</b></div></div>
              <div className="board-column"><small>ACTION</small><div className="action-card"><Zap size={15} /><b>Session approved</b><span>Recorded 00:14 ago</span></div><div className="action-card secondary"><ShieldCheck size={15} /><b>Boundary intact</b><span>Verified automatically</span></div></div>
              <div className="board-connector c1" /><div className="board-connector c2" />
            </div>
          </div>
        </section>

        <section className="access-section shell" id="access">
          <div className="access-card">
            <div className="access-icon"><ShieldCheck size={21} /></div>
            <div><div className="section-kicker">04 / ACCESS</div><h2>Put the whole system <em>in motion.</em></h2><p>Use your organization credentials to enter the secure Arka workspace.</p></div>
            <Link className="gradient-button" to="/login">Enter Arka <ArrowRight size={17} /></Link>
          </div>
        </section>
      </main>

      <footer className="arka-footer shell"><Brand /><span>SECURITY / IDENTITY / CONTROL</span><Link to="/login">Secure access <ArrowUpRight size={15} /></Link></footer>
    </div>
  );
}

function Flow({ label, value }: { label: string; value: string }) {
  return <div className="flow-step"><span className="flow-node"><Check size={12} /></span><div><small>{label}</small><b>{value}</b></div></div>;
}

function Proof({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="proof-row"><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></div>;
}
