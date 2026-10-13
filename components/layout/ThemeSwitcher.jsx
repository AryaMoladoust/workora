"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { THEMES, MODES, FONTS, THEME_COOKIE, MODE_COOKIE, FONT_COOKIE } from "../../lib/theme";

const MODE_ICONS = { light: "sun", dark: "moon", system: "monitor" };

function writeCookie(name, value) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export default function ThemeSwitcher({ initialTheme, initialMode, initialFont = "iranyekan" }) {
  const [theme, setTheme] = useState(initialTheme);
  const [mode, setMode] = useState(initialMode);
  const [font, setFont] = useState(initialFont);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pickTheme(id) {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    writeCookie(THEME_COOKIE, id);
  }

  function pickFont(id) {
    setFont(id);
    document.documentElement.dataset.font = id;
    writeCookie(FONT_COOKIE, id);
  }

  function pickMode(id) {
    setMode(id);
    document.documentElement.dataset.mode = id;
    writeCookie(MODE_COOKIE, id);
  }

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="تنظیمات ظاهر"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="drop" size={19} />
      </button>

      {open && (
        <div className="popover theme-popover" role="dialog" aria-label="ظاهر برنامه">
          <div className="popover-section">
            <span className="popover-label">حالت نمایش</span>
            <div className="segmented" role="radiogroup" aria-label="حالت نمایش">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  className={mode === m.id ? "is-selected" : ""}
                  onClick={() => pickMode(m.id)}
                >
                  <Icon name={MODE_ICONS[m.id]} size={16} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="popover-section">
            <span className="popover-label">رنگ تم</span>
            <div className="swatch-grid" role="radiogroup" aria-label="رنگ تم">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  className={`swatch ${theme === t.id ? "is-selected" : ""}`}
                  onClick={() => pickTheme(t.id)}
                  title={t.label}
                >
                  <span className="swatch-dot" style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}>
                    {theme === t.id && <Icon name="check" size={15} strokeWidth={2.6} />}
                  </span>
                  <span className="swatch-name">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
