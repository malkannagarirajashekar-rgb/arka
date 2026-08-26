export function Mandala() {
  return (
    <div className="mandala-wrap" aria-label="Sarv security architecture">
      <div className="mandala-grid" aria-hidden="true" />
      <div className="mandala-ring r1" aria-hidden="true" />
      <div className="mandala-ring r2" aria-hidden="true" />
      <div className="mandala-ring r3" aria-hidden="true" />
      <div className="mandala-cross c1" aria-hidden="true" />
      <div className="mandala-cross c2" aria-hidden="true" />
      <div className="mandala-sweep" aria-hidden="true" />

      <div className="mandala-core">
        <span className="mandala-logo" aria-hidden="true" />
      </div>

      <span className="mandala-label l1">IDENTIFY</span>
      <span className="mandala-label l2">PROTECT</span>
      <span className="mandala-label l3">DETECT</span>
      <span className="mandala-label l4">RESPOND</span>

      <i className="signal s1" aria-hidden="true" />
      <i className="signal s2" aria-hidden="true" />
      <i className="signal s3" aria-hidden="true" />
    </div>
  );
}
