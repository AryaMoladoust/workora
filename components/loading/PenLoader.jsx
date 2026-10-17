// Loading indicator: a full-screen blurred layer with the "W" of the logo written by a pen, over and over,
// until whatever is loading has finished. No hooks (pure SVG + CSS), so it works in server and client components.
//   blocking  – swallow clicks (use it while a form is being submitted); default lets clicks through (page loading)
//   delay     – seconds before it fades in (default .18 so fast pages never flash it; use 0 for form submits)
import { PEN_PATH, MARK_VIEWBOX, W_LAYER } from "../splash/wordmark";

export default function PenLoader({ blocking = false, delay = 0.18 }) {
  return (
    <div className={`pen-loader${blocking ? " is-blocking" : ""}`} style={{ "--wl-delay": `${delay}s` }} aria-hidden="true">
      <svg className="pen-loader-mark" viewBox={MARK_VIEWBOX}>
        <defs>
          <mask id="wl-pen" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
            <path d={PEN_PATH} className="wl-pen" pathLength="1" fill="none" stroke="#fff" strokeWidth="270" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 2" />
            <circle className="wl-head" cx="860" cy="330" r="190" fill="#fff" />
          </mask>
        </defs>
        <g className="wl-art">
          <g mask="url(#wl-pen)">
            <image href="/splash/w.webp" x={W_LAYER.x} y={W_LAYER.y} width={W_LAYER.w} height={W_LAYER.h} />
          </g>
        </g>
      </svg>
    </div>
  );
}
