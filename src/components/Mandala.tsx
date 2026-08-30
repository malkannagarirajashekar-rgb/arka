export function Mandala() {
  return (
    <div className="mandala-wrap" aria-label="Arka security intelligence system">
      <div className="mandala-grid" aria-hidden="true" />
      <div className="mandala-ring r1" aria-hidden="true" />
      <div className="mandala-ring r2" aria-hidden="true" />
      <div className="mandala-ring r3" aria-hidden="true" />
      <div className="mandala-cross c1" aria-hidden="true" />
      <div className="mandala-cross c2" aria-hidden="true" />
      <div className="mandala-sweep" aria-hidden="true" />
      <div className="mandala-core">
        <img className="mandala-logo" src="/brand/arka-logo-clean.png" alt="" aria-hidden="true" />
      </div>
      <span className="mandala-label l1">OBSERVE</span>
      <span className="mandala-label l2">PROTECT</span>
      <span className="mandala-label l3">RESPOND</span>
      <span className="mandala-label l4">CONTROL</span>
      <i className="signal s1" aria-hidden="true" />
      <i className="signal s2" aria-hidden="true" />
      <i className="signal s3" aria-hidden="true" />
    </div>
  );
}
