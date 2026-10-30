"use client";

import { useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { dayKey } from "../../lib/format";
import { JALALI_MONTHS, faDigits, jalaliMonthLength, jalaliToGregorianKey, jalaliWeekday, parseGregorianKey } from "../../lib/jalali";

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // the Jalali week starts on Saturday; Friday is the weekend
const WEIGHT = { urgent: 0, high: 1, medium: 2, low: 3 };
const SHOWN = 3; // tasks shown in a day before "+ n more"

// Monthly Jalali calendar: every task sits on its due date. Click a task to open it.
export default function TaskCalendar({ tasks, onOpen }) {
  const today = dayKey(new Date());
  const t = parseGregorianKey(today);
  const [cur, setCur] = useState({ jy: t.jy, jm: t.jm });
  const [expanded, setExpanded] = useState(null);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      if (!task.dueInput) continue;
      if (!map.has(task.dueInput)) map.set(task.dueInput, []);
      map.get(task.dueInput).push(task);
    }
    for (const list of map.values()) list.sort((a, b) => (a.status === "done") - (b.status === "done") || WEIGHT[a.priority] - WEIGHT[b.priority]);
    return map;
  }, [tasks]);

  const undated = tasks.filter((x) => !x.dueInput && x.status !== "done").length;
  const length = jalaliMonthLength(cur.jy, cur.jm);
  const lead = jalaliWeekday(cur.jy, cur.jm, 1);
  const cells = [...Array(lead).fill(null), ...Array.from({ length }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  function shift(n) {
    const total = cur.jy * 12 + (cur.jm - 1) + n;
    setCur({ jy: Math.floor(total / 12), jm: (total % 12) + 1 });
    setExpanded(null);
  }

  const inMonth = cells.filter(Boolean).reduce((sum, d) => sum + (byDay.get(jalaliToGregorianKey(cur.jy, cur.jm, d))?.length || 0), 0);

  return (
    <section className="tcal" aria-label="تقویم وظایف">
      <header className="tcal-head">
        <div className="tcal-nav">
          <button type="button" className="icon-button" aria-label="ماه قبل" onClick={() => shift(-1)}><Icon name="chevronRight" size={18} /></button>
          <button type="button" className="icon-button" aria-label="ماه بعد" onClick={() => shift(1)}><Icon name="chevronLeft" size={18} /></button>
        </div>
        <h3>{JALALI_MONTHS[cur.jm - 1]} {faDigits(cur.jy)}</h3>
        <span className="chip">{faDigits(inMonth)} وظیفه</span>
        <button type="button" className="secondary-button tcal-today" onClick={() => { setCur({ jy: t.jy, jm: t.jm }); setExpanded(null); }}>امروز</button>
      </header>

      <div className="tcal-scroll">
        <div className="tcal-grid" role="grid">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`tcal-dow ${i === 6 ? "is-weekend" : ""}`} role="columnheader">{w}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} className="tcal-cell is-blank" />;
            const key = jalaliToGregorianKey(cur.jy, cur.jm, d);
            const items = byDay.get(key) || [];
            const open = expanded === key;
            const visible = open ? items : items.slice(0, SHOWN);
            return (
              <div key={key} role="gridcell" className={`tcal-cell ${key === today ? "is-today" : ""} ${i % 7 === 6 ? "is-weekend" : ""}`}>
                <span className="tcal-day">{faDigits(d)}</span>
                <div className="tcal-tasks">
                  {visible.map((task) => (
                    <button key={task.id} type="button" className={`cal-task prio-${task.priority} ${task.status === "done" ? "is-done" : ""} ${task.dueTone === "overdue" ? "is-overdue" : ""}`} title={task.title} onClick={() => onOpen(task)}>
                      <span className="cal-dot" />
                      <span className="cal-title">{task.title}</span>
                    </button>
                  ))}
                  {items.length > SHOWN && (
                    <button type="button" className="cal-more" onClick={() => setExpanded(open ? null : key)}>
                      {open ? "کمتر" : `+${faDigits(items.length - SHOWN)} مورد دیگر`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated > 0 && <p className="tcal-note"><Icon name="calendar" size={14} /> {faDigits(undated)} وظیفه‌ی باز مهلت ندارد و در تقویم دیده نمی‌شود.</p>}
    </section>
  );
}
