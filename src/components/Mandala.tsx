export function Mandala() {
  return (
    <div className="mandala-wrap" aria-label="Trinetra security architecture">
      <div className="mandala-grid" />
      <div className="mandala-ring r1" />
      <div className="mandala-ring r2" />
      <div className="mandala-ring r3" />
      <div className="mandala-cross c1" />
      <div className="mandala-cross c2" />
      <div className="mandala-core">ॐ</div>
      <span className="mandala-label l1">IDENTIFY</span>
      <span className="mandala-label l2">PROTECT</span>
      <span className="mandala-label l3">DETECT</span>
      <span className="mandala-label l4">RESPOND</span>
      <i className="signal s1" /><i className="signal s2" /><i className="signal s3" />
    </div>
  );
}
