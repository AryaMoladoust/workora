import { fa } from "../../lib/format";

// Circular progress used on the profile page and the dashboard card.
export default function CompletenessRing({ percent, size = 76 }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <span className="pf-ring" style={{ width: size, height: size }} role="img" aria-label={`${percent} درصد کامل`}>
      <svg viewBox="0 0 72 72" width={size} height={size}>
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="pf-ring-track" />
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className="pf-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} transform="rotate(-90 36 36)" />
      </svg>
      <b>{fa(percent)}٪</b>
    </span>
  );
}
