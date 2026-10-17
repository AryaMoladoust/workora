// Loading indicator: the "W" of the logo is written by a pen, over and over, until the page has loaded.
// Server-safe (no hooks, pure SVG + CSS), so it can be rendered from any loading.jsx.
// It appears after a short delay (see .pen-loader in globals.css) so fast pages never flash it.
import { PEN_PATH, MARK_VIEWBOX, W_LAYER } from "../splash/wordmark";

export default function PenLoader() {
  return (
    <div className="pen-loader-anchor" aria-hidden="true">
      <div className="pen-loader">
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
    </div>
  );
}
