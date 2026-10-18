"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { dayKey } from "../../lib/format";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  faDigits,
  formatJalali,
  jalaliMonthLength,
  jalaliToGregorianKey,
  jalaliWeekday,
  parseGregorianKey,
  toJalali,
} from "../../lib/jalali";

// Jalali (Shamsi) date field. The value it reads and reports is the Gregorian "YYYY-MM-DD" string the API already uses,
// so forms only swap <input type="date"> for this component.
//   value / onChange(value) / min ("YYYY-MM-DD", earlier days are disabled) / disabled
const POPUP_W = 304;

export default function JalaliDateInput({ value, onChange, min, disabled = false, placeholder = "انتخاب تاریخ", clearable = true, id }) {
  const buttonRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, sheet: false });
  const todayKey = useMemo(() => dayKey(new Date()), []);
  const today = useMemo(() => parseGregorianKey(todayKey), [todayKey]);
  const selected = parseGregorianKey(value);
  const [view, setView] = useState(() => selected || today);

  const close = useCallback(() => setOpen(false), []);

  function toggle() {
    if (disabled) return;
    if (!open) setView(parseGregorianKey(value) || today);
    setOpen((v) => !v);
  }

  // place the popup under the field (or as a bottom sheet on small screens)
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const sheet = window.innerWidth <= 520;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - POPUP_W / 2), window.innerWidth - POPUP_W - 8);
    const below = rect.bottom + 8;
    const height = 372;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 8) : below;
    setPos({ top, left, sheet });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (popRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      close();
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.stopImmediatePropagation();
        close();
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true); // before the dialog's own Escape handler
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const years = useMemo(() => {
    const base = today.jy;
    const from = Math.min(base - 6, view.jy, selected?.jy ?? base);
    const to = Math.max(base + 12, view.jy, selected?.jy ?? base);
    const list = [];
    for (let y = from; y <= to; y += 1) list.push(y);
    return list;
  }, [today.jy, view.jy, selected?.jy]);

  function shiftMonth(delta) {
    setView((v) => {
      let jm = v.jm + delta;
      let jy = v.jy;
      if (jm < 1) { jm = 12; jy -= 1; }
      if (jm > 12) { jm = 1; jy += 1; }
      return { jy, jm, jd: 1 };
    });
  }

  function pick(jd) {
    onChange(jalaliToGregorianKey(view.jy, view.jm, jd));
    close();
    buttonRef.current?.focus();
  }

  const length = jalaliMonthLength(view.jy, view.jm);
  const offset = jalaliWeekday(view.jy, view.jm, 1);
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= length; d += 1) cells.push(d);

  const display = selected ? formatJalali(selected.jy, selected.jm, selected.jd) : "";

  const popup = open
    ? createPortal(
        <>
          {pos.sheet && <div className="jdp-backdrop" onPointerDown={close} />}
          <div
            ref={popRef}
            className={`jdp-pop${pos.sheet ? " is-sheet" : ""}`}
            style={pos.sheet ? undefined : { top: pos.top, left: pos.left, width: POPUP_W }}
            role="dialog"
            aria-label="انتخاب تاریخ شمسی"
            dir="rtl"
          >
            <div className="jdp-head">
              <button type="button" className="jdp-nav" aria-label="ماه قبل" onClick={() => shiftMonth(-1)}>
                <Icon name="chevronRight" size={18} />
              </button>
              <div className="jdp-selects">
                <select aria-label="ماه" value={view.jm} onChange={(e) => setView({ ...view, jm: Number(e.target.value) })}>
                  {JALALI_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                </select>
                <select aria-label="سال" value={view.jy} onChange={(e) => setView({ ...view, jy: Number(e.target.value) })}>
                  {years.map((y) => <option key={y} value={y}>{faDigits(y)}</option>)}
                </select>
              </div>
              <button type="button" className="jdp-nav" aria-label="ماه بعد" onClick={() => shiftMonth(1)}>
                <Icon name="chevronLeft" size={18} />
              </button>
            </div>

            <div className="jdp-grid jdp-week" aria-hidden="true">
              {JALALI_WEEKDAYS_SHORT.map((w, i) => <span key={w} className={i === 6 ? "is-fri" : ""}>{w}</span>)}
            </div>
            <div className="jdp-grid">
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} />;
                const key = jalaliToGregorianKey(view.jy, view.jm, d);
                const isSel = selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === d;
                const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === d;
                const off = Boolean(min) && key < min;
                const fri = (offset + d - 1) % 7 === 6;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={off}
                    className={`jdp-day${isSel ? " is-selected" : ""}${isToday ? " is-today" : ""}${fri ? " is-fri" : ""}`}
                    aria-pressed={Boolean(isSel)}
                    onClick={() => pick(d)}
                  >
                    {faDigits(d)}
                  </button>
                );
              })}
            </div>

            <div className="jdp-foot">
              <button
                type="button"
                className="jdp-link"
                disabled={Boolean(min) && todayKey < min}
                onClick={() => { onChange(todayKey); close(); }}
              >
                امروز
              </button>
              {clearable && value && (
                <button type="button" className="jdp-link is-danger" onClick={() => { onChange(""); close(); }}>
                  پاک کردن
                </button>
              )}
            </div>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <button
        type="button"
        id={id}
        ref={buttonRef}
        className={`jdp-field${display ? "" : " is-empty"}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <span>{display || placeholder}</span>
        <Icon name="calendar" size={17} />
      </button>
      {popup}
    </>
  );
}
