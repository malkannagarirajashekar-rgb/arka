import { motion } from "motion/react";
import { useMemo, useState } from "react";
import {
  Fingerprint, Globe2, Layers3, ScanLine, Shield,
  Users, Zap
} from "lucide-react";

type GuardianNode = {
  id: string; label: string; hint: string; icon: typeof Fingerprint;
  x: number; y: number; tone?: "copper" | "ivory";
};

const NODES: GuardianNode[] = [
  { id: "identity", label: "Identity", hint: "WHO", icon: Fingerprint, x: 17, y: 32 },
  { id: "people", label: "People", hint: "ACTORS", icon: Users, x: 50, y: 12 },
  { id: "infrastructure", label: "Infrastructure", hint: "WHERE", icon: Globe2, x: 82, y: 31, tone: "ivory" },
  { id: "applications", label: "Applications", hint: "WHAT", icon: Layers3, x: 78, y: 71 },
  { id: "policy", label: "Policy", hint: "WHY", icon: Shield, x: 21, y: 73, tone: "copper" },
  { id: "signals", label: "Signals", hint: "NOW", icon: Zap, x: 50, y: 88, tone: "copper" },
];

const LINKS = [
  ["identity", "people"], ["people", "infrastructure"], ["people", "applications"],
  ["identity", "policy"], ["policy", "applications"], ["infrastructure", "signals"], ["applications", "signals"],
];

export default function TempleScene({ compact = false, mode = "home", onAction }: {
  compact?: boolean; mode?: "home" | "login" | "workspace"; onAction?: (label: string) => void;
}) {
  const [active, setActive] = useState("identity");
  const [ritual, setRitual] = useState<"idle" | "scan" | "attuned">("idle");
  const [orbit, setOrbit] = useState(0);
  const selected = useMemo(() => NODES.find((node) => node.id === active) ?? NODES[0], [active]);

  function runRitual() {
    if (ritual === "scan") return;
    setRitual("scan");
    window.setTimeout(() => setRitual("attuned"), 1250);
    window.setTimeout(() => setRitual("idle"), 2500);
  }

  function rotateGuardian() { setOrbit((current) => (current + 18) % 360); }

  return (
    <div className={`arka-temple guardian-temple ${compact ? "compact" : ""} temple-${mode}`} style={{ ["--temple-rotation" as string]: `${orbit}deg` }}>
      <div className="temple-aura aura-one" /><div className="temple-aura aura-two" />
      <div className="temple-header">
        <div className="temple-status"><span /> GUARDIAN / {mode === "login" ? "SECURE GATE" : mode === "workspace" ? "LIVE" : "CONTEXT CORE"}</div>
        <button className="temple-control" onClick={runRitual} aria-label="Scan guardian context"><ScanLine size={12} /> {ritual === "scan" ? "SCANNING" : ritual === "attuned" ? "GUARDED" : "SCAN"}</button>
      </div>

      <div className="temple-stage">
        <div className="temple-grid" /><div className="temple-halo halo-outer" /><div className="temple-halo halo-middle" /><div className="temple-halo halo-inner" />
        <svg className="temple-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {LINKS.map(([from, to], i) => {
            const a = NODES.find((n) => n.id === from)!; const b = NODES.find((n) => n.id === to)!;
            return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={from === active || to === active ? "active" : ""} style={{ animationDelay: `${i * 160}ms` }} />;
          })}
        </svg>

        <button className="temple-sanctum" onClick={rotateGuardian} aria-label="Rotate guardian core">
          <div className="sanctum-ring ring-a" /><div className="sanctum-ring ring-b" /><div className="sanctum-ring ring-c" />
          <div className={`sanctum-glyph ${ritual}`}><img src="/brand/arka-logo-transparent.png" alt="Arka" /></div>
          <div className="sanctum-label">GUARDIAN / CORE</div>
        </button>

        {NODES.map((node) => {
          const Icon = node.icon; const selectedNode = active === node.id;
          return <button key={node.id} className={`temple-node ${selectedNode ? "selected" : ""} ${node.tone ?? ""}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            onClick={() => { setActive(node.id); onAction?.(node.label); }}>
            <span className="temple-node-orbit" /><span className="temple-node-icon"><Icon size={14} /></span>
            <span className="temple-node-copy"><b>{node.label}</b><small>{node.hint}</small></span>
          </button>;
        })}

        <div className="temple-axis axis-x" /><div className="temple-axis axis-y" />
        {ritual === "scan" && <motion.div className="temple-scanline" initial={{ top: 0 }} animate={{ top: "100%" }} transition={{ duration: 1.15, ease: "linear" }} />}
      </div>

      <div className="temple-footer">
        <div className="temple-reading"><small>ACTIVE WARD</small><strong>{selected.label}</strong><span>{selected.hint} / relationship context exposed</span></div>
        <div className="temple-balance"><div><small>GUARD STATE</small><strong>{ritual === "attuned" ? "GUARDED" : "STABLE"}</strong></div><div><small>LINKS</small><strong>07</strong></div><div><small>CORE</small><strong>ONLINE</strong></div></div>
      </div>
    </div>
  );
}
