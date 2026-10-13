// Skeleton building blocks (server-safe, no hooks). Every block fades in and out; `d` staggers the pulse.
export function Sk({ w, h = 14, r, circle = false, d = 0, className = "", style }) {
  return (
    <span
      aria-hidden="true"
      className={`sk ${circle ? "sk-circle" : ""} ${className}`}
      style={{ width: w, height: h, borderRadius: r, animationDelay: d ? `${d * 0.12}s` : undefined, ...style }}
    />
  );
}

export function SkLines({ widths = [100, 86, 60], h = 12, d = 0 }) {
  return (
    <span className="sk-stack" aria-hidden="true">
      {widths.map((w, i) => (
        <Sk key={i} w={`${w}%`} h={h} d={d + i} />
      ))}
    </span>
  );
}

export function SkStatus({ children }) {
  return <span className="sr-only" role="status">{children || "در حال بارگذاری..."}</span>;
}

export function SkCard({ children, className = "" }) {
  return <div className={`sk-card-pad ${className}`}>{children}</div>;
}

export function SkHeading({ action = false, narrow = false }) {
  return (
    <div className="page-heading" aria-hidden="true">
      <div className="sk-stack">
        <Sk w={72} h={12} />
        <Sk w={narrow ? 150 : 190} h={30} d={1} />
        <Sk w={280} h={14} d={2} />
      </div>
      {action && <Sk w={130} h={44} r={12} d={2} />}
    </div>
  );
}

export function SkToolbar({ tabs = 3, action = true }) {
  return (
    <div className="toolbar" aria-hidden="true">
      <Sk w={300} h={44} r={12} />
      <Sk w={tabs * 78} h={44} r={14} d={1} />
      {action && <Sk w={130} h={44} r={12} d={2} className="sk-push" />}
    </div>
  );
}

// ---- repeated rows ----------------------------------------------------------------------------
export function SkTaskRows({ count = 5 }) {
  return (
    <div className="sk-stack" style={{ gap: 14 }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-row" key={i}>
          <Sk w={10} h={10} circle d={i} />
          <span className="sk-stack" style={{ gap: 7 }}>
            <Sk w={`${72 - (i % 3) * 14}%`} h={14} d={i} />
            <Sk w={`${40 - (i % 2) * 8}%`} h={10} d={i + 1} />
          </span>
          <Sk w={70} h={24} r={999} d={i} />
          <Sk w={64} h={14} d={i + 1} />
        </div>
      ))}
    </div>
  );
}

export function SkFeedRows({ count = 5 }) {
  return (
    <div className="sk-stack" style={{ gap: 18 }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-row" key={i} style={{ alignItems: "flex-start" }}>
          <Sk w={38} h={38} circle d={i} />
          <span className="sk-stack" style={{ gap: 8 }}>
            <Sk w={`${88 - (i % 3) * 12}%`} h={13} d={i} />
            <Sk w={`${34 + (i % 2) * 10}%`} h={10} d={i + 1} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SkProgressRows({ count = 4 }) {
  return (
    <div className="sk-stack" style={{ gap: 20 }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span className="sk-stack" style={{ gap: 9 }} key={i}>
          <span className="sk-row" style={{ justifyContent: "space-between" }}>
            <Sk w={`${55 - (i % 2) * 12}%`} h={14} d={i} />
            <Sk w={34} h={14} d={i} />
          </span>
          <Sk w="100%" h={8} r={999} d={i + 1} />
          <Sk w={`${42 - (i % 2) * 10}%`} h={10} d={i + 2} />
        </span>
      ))}
    </div>
  );
}

export function SkStatGrid() {
  return (
    <div className="stat-grid" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div className="stat" key={i}>
          <Sk w={48} h={48} r={14} d={i} />
          <span className="sk-stack" style={{ gap: 8 }}>
            <Sk w={90} h={12} d={i} />
            <Sk w={46} h={26} d={i + 1} />
            <Sk w={110} h={10} d={i + 2} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SkCardHead() {
  return (
    <div className="sk-row" style={{ justifyContent: "space-between" }} aria-hidden="true">
      <span className="sk-row">
        <Sk w={32} h={32} r={10} />
        <Sk w={130} h={16} d={1} />
      </span>
      <Sk w={70} h={12} d={2} />
    </div>
  );
}
