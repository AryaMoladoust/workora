"use client";

import { useState } from "react";
import Icon from "../ui/Icon";
import { LABELS_MAX, LABEL_COLORS } from "../../lib/task-constants";

// Labels of one project ("urgent", "bug", "design" ...). Tasks of the project can carry any of them and the
// task lists can be filtered by label. Removing a label also removes it from the tasks that had it.
export default function LabelsManager({ projectId, initial }) {
  const [labels, setLabels] = useState(initial);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[5]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ kind: "", text: "" });

  const nextColor = (c) => LABEL_COLORS[(LABEL_COLORS.indexOf(c) + 1) % LABEL_COLORS.length];
  const update = (i, patch) => setLabels((list) => list.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  function add(event) {
    event.preventDefault();
    const clean = name.replace(/\s+/g, " ").trim();
    if (!clean || labels.length >= LABELS_MAX) return;
    if (labels.some((l) => l.name.toLowerCase() === clean.toLowerCase())) {
      setNote({ kind: "error", text: "این برچسب از قبل وجود دارد." });
      return;
    }
    setLabels([...labels, { id: "", name: clean, color }]);
    setName("");
    setNote({ kind: "", text: "" });
  }

  async function save() {
    setBusy(true);
    setNote({ kind: "", text: "" });
    try {
      const res = await fetch(`/api/projects/${projectId}/labels`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labels }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ذخیره‌ی برچسب‌ها انجام نشد.");
      setLabels(data.labels);
      setNote({ kind: "ok", text: "برچسب‌ها ذخیره شد." });
    } catch (e) {
      setNote({ kind: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card settings-card labels-manager">
      <div className="card-head">
        <h2 className="card-title"><span className="card-title-icon"><Icon name="tag" size={17} /></span>برچسب‌های وظایف</h2>
      </div>
      <p className="field-hint">برای دسته‌بندی وظایف این پروژه، مثلاً «فوری»، «باگ» یا «طراحی». روی نقطه‌ی رنگی بزنید تا رنگ عوض شود.</p>

      <ul className="lbl-list">
        {labels.map((l, i) => (
          <li key={l.id || `new-${i}`}>
            <button type="button" className="lbl-swatch" style={{ background: l.color }} aria-label={`تغییر رنگ ${l.name}`} onClick={() => update(i, { color: nextColor(l.color) })} />
            <input value={l.name} maxLength={30} aria-label="نام برچسب" onChange={(e) => update(i, { name: e.target.value })} />
            <button type="button" className="icon-button" aria-label={`حذف ${l.name}`} onClick={() => setLabels(labels.filter((_, idx) => idx !== i))}>
              <Icon name="trash" size={16} />
            </button>
          </li>
        ))}
        {labels.length === 0 && <li className="field-hint">هنوز برچسبی ساخته نشده است.</li>}
      </ul>

      {labels.length < LABELS_MAX && (
        <form className="lbl-add" onSubmit={add}>
          <button type="button" className="lbl-swatch" style={{ background: color }} aria-label="تغییر رنگ برچسب جدید" onClick={() => setColor(nextColor(color))} />
          <input value={name} maxLength={30} placeholder="نام برچسب جدید..." onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="secondary-button"><Icon name="plus" size={16} />افزودن</button>
        </form>
      )}

      {note.text && <div className={note.kind === "ok" ? "auth-success" : "form-error"} role={note.kind === "ok" ? "status" : "alert"}>{note.text}</div>}
      <div className="settings-actions"><button type="button" className="primary-button" disabled={busy} onClick={save}>{busy ? "در حال ذخیره..." : "ذخیره‌ی برچسب‌ها"}</button></div>
    </section>
  );
}
