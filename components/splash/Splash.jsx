"use client";

import { useEffect, useState } from "react";
import { WORD, TAG } from "./wordmark";

// Splash screen shown once per browser session / app launch.
// 1) the "W" is written by a pen sweep and ends in the arrow   2) the team icons pop up behind it
// 3) "Workora" is written with a stroke, then filled           4) "TEAM MANAGEMENT" fades in below.
// The logo is split into layers (public/splash/*.webp) cut from the real logo, so it matches the app icon exactly.

const KEY = "workora_splash";
const LAYERS = {
  w: { x: 85, y: 212, w: 858, h: 580 },
  body_c: { x: 398, y: 373, w: 219, h: 194 },
  head_c: { x: 435, y: 235, w: 143, h: 144 },
  head_l: { x: 317, y: 294, w: 108, h: 109 },
  head_r: { x: 594, y: 296, w: 108, h: 108 },
  body_l: { x: 301, y: 395, w: 117, h: 174 },
  body_r: { x: 597, y: 396, w: 120, h: 173 },
};
// centre line the "pen" follows (1024 × 1024 logo space)
const PEN =
  "M 140 410 L 285 700 C 310 755, 360 775, 405 735 C 440 700, 470 610, 500 548 C 520 520, 545 540, 560 570 L 640 715 C 665 775, 715 780, 745 725 L 880 380 L 915 285";
// the part of the artwork we actually need (trims the empty margins)
const VIEWBOX = "70 195 890 610";
const PEOPLE = ["body_c", "head_c", "body_l", "head_l", "body_r", "head_r"];

function Layer({ name, className }) {
  const m = LAYERS[name];
  return <image href={`/splash/${name}.webp`} x={m.x} y={m.y} width={m.w} height={m.h} className={className} />;
}

export default function Splash() {
  const [phase, setPhase] = useState("loading"); // loading → playing → leaving → gone
  const [reduce, setReduce] = useState(false);

  // decide whether to show it, and wait until the logo layers are decoded so the animation never stutters
  useEffect(() => {
    if (document.documentElement.getAttribute("data-splash") === "off") {
      setPhase("gone");
      return undefined;
    }
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* private mode: just show it again next time */
    }
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      setPhase("playing");
    };
    const decodes = ["w", ...PEOPLE].map((name) => {
      const img = new Image();
      img.src = `/splash/${name}.webp`;
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    });
    Promise.all(decodes).then(start);
    const safety = setTimeout(start, 1600); // never block the app on a slow connection
    return () => clearTimeout(safety);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return undefined;
    const total = reduce ? 900 : 4400;
    const leave = setTimeout(() => setPhase("leaving"), total);
    const gone = setTimeout(() => setPhase("gone"), total + 650);
    return () => {
      clearTimeout(leave);
      clearTimeout(gone);
    };
  }, [phase, reduce]);

  if (phase === "gone") return null;

  return (
    <div
      className={`splash is-${phase}${reduce ? " is-reduced" : ""}`}
      role="status"
      aria-label="Workora – Team Management"
      onClick={() => phase === "playing" && setPhase("leaving")}
    >
      <div className="splash-glow" aria-hidden="true" />

      <svg className="splash-mark" viewBox={VIEWBOX} aria-hidden="true">
        <defs>
          <mask id="wk-pen" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
            <path d={PEN} className="wk-pen" pathLength="1" fill="none" stroke="#fff" strokeWidth="270" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 2" />
            <circle className="wk-head" cx="860" cy="330" r="190" fill="#fff" />
          </mask>
        </defs>
        <g className="wk-logo">
          {PEOPLE.map((name) => (
            <Layer key={name} name={name} className={`wk-person wk-${name}`} />
          ))}
          <g mask="url(#wk-pen)">
            <Layer name="w" className="wk-w" />
          </g>
          <Layer name="w" className="wk-w-full" />
        </g>
      </svg>

      <svg className="splash-word" viewBox={WORD.vb.join(" ")} aria-hidden="true">
        <defs>
          <linearGradient id="wk-word-fill" gradientUnits="userSpaceOnUse" x1={WORD.vb[0]} y1="0" x2={WORD.vb[0] + WORD.vb[2]} y2="0">
            <stop offset="0" stopColor="#5ee0ff" />
            <stop offset="0.55" stopColor="#3b9bff" />
            <stop offset="1" stopColor="#2f6bff" />
          </linearGradient>
        </defs>
        {WORD.glyphs.map((d, i) => (
          <path key={i} d={d} pathLength="1" className="wk-letter" style={{ "--i": i }} />
        ))}
      </svg>

      <span className="splash-rule" aria-hidden="true" />

      <svg className="splash-tag" viewBox={TAG.vb.join(" ")} aria-hidden="true">
        {TAG.glyphs.map((d, i) => (
          <path key={i} d={d} className="wk-tag-letter" style={{ "--i": i }} />
        ))}
      </svg>
    </div>
  );
}
