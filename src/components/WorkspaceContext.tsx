import { useMemo, useState } from "react";
import { AppWindow, CircleUserRound, Network, ShieldCheck, Zap } from "lucide-react";

const layers = [
  { id: "identity", label: "Identity", hint: "WHO", icon: CircleUserRound },
  { id: "policy", label: "Policy", hint: "WHY", icon: ShieldCheck },
  { id: "applications", label: "Applications", hint: "WHAT", icon: AppWindow },
  { id: "activity", label: "Activity", hint: "NOW", icon: Zap },
  { id: "network", label: "Network", hint: "WHERE", icon: Network },
] as const;

export default function WorkspaceContext({ role, appCount }: { role: "tenant_admin" | "tenant_user"; appCount: number }) {
  const [active, setActive] = useState("identity");
  const current = useMemo(() => layers.find((layer) => layer.id === active) ?? layers[0], [active]);
  const CurrentIcon = current.icon;

  return (
    <section className="workspace-context" aria-labelledby="workspace-context-title">
      <div className="workspace-context-copy">
        <p className="eyebrow"><span /> ARKA / SYSTEM CONTEXT</p>
        <h3 id="workspace-context-title">Everything connected.<br /><em>Nothing ornamental.</em></h3>
        <p className="workspace-context-description">
          {role === "tenant_admin"
            ? "Your organization boundary, people, policy and applications resolve into one operating view."
            : "Your identity, access boundary and connected applications resolve into one operating view."}
        </p>
        <div className="workspace-context-reading">
          <div className="workspace-context-reading-icon"><CurrentIcon size={17} /></div>
          <div><small>ACTIVE LAYER</small><strong>{current.label}</strong><span>{current.hint} / connected context</span></div>
        </div>
      </div>

      <div className="workspace-context-map">
        <div className="workspace-context-grid" aria-hidden="true" />
        <div className="workspace-context-wash wash-one" aria-hidden="true" />
        <div className="workspace-context-wash wash-two" aria-hidden="true" />
        <svg className="workspace-context-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M18 26 C34 30, 39 42, 50 50" />
          <path d="M20 74 C34 69, 39 58, 50 50" />
          <path d="M82 27 C68 31, 62 42, 50 50" />
          <path d="M81 72 C68 68, 62 58, 50 50" />
          <path d="M50 8 C50 24, 50 35, 50 50" />
        </svg>

        <div className="workspace-context-core">
          <div className="workspace-context-core-ring" />
          <span>ARKA</span>
          <small>CONTEXT CORE</small>
          <i />
        </div>

        {layers.map((layer, index) => {
          const Icon = layer.icon;
          return (
            <button
              key={layer.id}
              className={`workspace-context-node node-${index + 1} ${active === layer.id ? "is-active" : ""}`}
              onClick={() => setActive(layer.id)}
              aria-label={`Inspect ${layer.label} context`}
            >
              <span className="workspace-context-node-icon"><Icon size={15} /></span>
              <span><strong>{layer.label}</strong><small>{layer.hint}</small></span>
            </button>
          );
        })}

        <div className="workspace-context-metrics">
          <span><small>APPS</small><strong>{String(appCount).padStart(2, "0")}</strong></span>
          <span><small>BOUNDARY</small><strong>ACTIVE</strong></span>
          <span><small>TRACE</small><strong>LIVE</strong></span>
        </div>
      </div>
    </section>
  );
}
