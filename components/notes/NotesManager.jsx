"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";

const LABELS = {
  note: { title: "یادداشت", add: "یادداشت جدید", empty: "هنوز یادداشتی ندارید", emptyHint: "متن‌ها و نکته‌های مهم تیم را اینجا نگه دارید.", titlePh: "عنوان یادداشت", bodyPh: "متن یادداشت...", icon: "note" },
  proxy: { title: "پروکسی", add: "پروکسی جدید", empty: "هنوز پروکسی‌ای به اشتراک نگذاشته‌اید", emptyHint: "لینک پروکسی (تلگرام MTProto، SOCKS، HTTP و ...) را اینجا بگذارید تا همکاران با یک کلیک کپی کنند.", titlePh: "نام پروکسی (مثلاً پروکسی تلگرام آلمان)", bodyPh: "لینک یا مشخصات پروکسی را اینجا بچسبانید (مثلاً tg://proxy?server=...)", icon: "globe" },
  config: { title: "کانفیگ", add: "کانفیگ جدید", empty: "هنوز کانفیگی ندارید", emptyHint: "کانفیگ‌های v2ray، تنظیمات سرور، متغیرهای محیطی و هر متن فنی دیگری را اینجا ذخیره کنید.", titlePh: "نام کانفیگ (مثلاً v2ray سرور آلمان)", bodyPh: "متن کانفیگ را اینجا بچسبانید...", icon: "code" },
};

const SCOPE_LABELS = { private: "شخصی", workspace: "همه اعضا", project: "اعضای پروژه" };

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes.toLocaleString("fa-IR")} بایت`;
  return `${(bytes / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} کیلوبایت`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

export default function NotesManager({ kind, initialNotes, projects }) {
  const L = LABELS[kind];
  const isConfig = kind !== "note";
  const [notes, setNotes] = useState(initialNotes);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [editor, setEditor] = useState(null); // { mode, note }
  const [opening, setOpening] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const first = useRef(true);

  /* search / scope filter go to the server (it can look inside the text) */
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ kind });
        if (q.trim()) params.set("q", q.trim());
        if (scope !== "all") params.set("scope", scope);
        const r = await fetch(`/api/notes?${params}`, { cache: "no-store" });
        const d = await r.json();
        if (r.ok) setNotes(d.notes);
      } catch {
        /* keep current list */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, scope, kind]);

  function flash(message) {
    setToast(message);
    setTimeout(() => setToast(""), 2200);
  }

  async function openNote(note) {
    setError("");
    setOpening(true);
    try {
      const r = await fetch(`/api/notes/${note.id}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "باز کردن انجام نشد.");
      setEditor({ mode: "edit", note: d.note });
    } catch (e) {
      setError(e.message);
    } finally {
      setOpening(false);
    }
  }

  async function copyFromCard(event, note) {
    event.stopPropagation();
    try {
      const r = await fetch(`/api/notes/${note.id}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      flash((await copyText(d.note.body)) ? "کپی شد ✓" : "کپی انجام نشد");
    } catch {
      flash("کپی انجام نشد");
    }
  }

  function applySaved(saved, isNew) {
    setNotes((list) => {
      const next = isNew ? [saved, ...list] : list.map((n) => (n.id === saved.id ? saved : n));
      return next.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  return (
    <>
      <div className="toolbar">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input type="search" placeholder={isConfig ? "جستجو در نام، تگ و متن کانفیگ‌ها..." : "جستجو در عنوان، تگ و متن..."} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="filter-tabs" role="tablist">
          {[["all", "همه"], ["private", "شخصی"], ["shared", "اشتراکی"]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={scope === id} className={scope === id ? "is-active" : ""} onClick={() => setScope(id)}>{label}</button>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={() => setEditor({ mode: "create" })}>
          <Icon name="plus" size={18} />
          {L.add}
        </button>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      {notes.length === 0 ? (
        <div className="empty-state">
          <h2>{q || scope !== "all" ? "موردی پیدا نشد" : L.empty}</h2>
          <p>{q || scope !== "all" ? "جستجو یا فیلتر را تغییر دهید." : L.emptyHint}</p>
          {!q && scope === "all" && <button type="button" className="primary-button" onClick={() => setEditor({ mode: "create" })}>{L.add}</button>}
        </div>
      ) : (
        <div className="note-grid">
          {notes.map((n) => (
            <article key={n.id} className={`note-card ${n.pinned ? "is-pinned" : ""} ${isConfig ? "is-config" : ""}`} onClick={() => !opening && openNote(n)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openNote(n)}>
              <header className="note-card-head">
                <span className="note-card-icon"><Icon name={L.icon} size={18} /></span>
                <h3>{n.title}</h3>
                {n.pinned && <Icon name="sparkles" size={15} className="pin-mark" />}
              </header>

              {isConfig ? (
                <p className="note-card-meta"><Icon name="check" size={13} strokeWidth={2.4} />محتوا پنهان است · برای کپی دکمه‌ی کنار را بزنید · {formatSize(n.size)}</p>
              ) : (
                <p className="note-card-snippet">{n.snippet || "بدون متن"}</p>
              )}

              {n.tags.length > 0 && (
                <div className="tag-row">{n.tags.map((t) => <span className="tag" key={t}>#{t}</span>)}</div>
              )}

              <footer className="note-card-foot">
                <span className={`chip ${n.scope === "private" ? "" : "chip-member"}`}>
                  {n.scope === "project" ? `پروژه: ${n.projectName || "—"}` : SCOPE_LABELS[n.scope]}
                </span>
                <small>{n.scope === "private" ? n.updatedText : `${n.ownerName} · ${n.updatedText}`}</small>
                <button type="button" className="icon-button note-copy" title="کپی متن" aria-label="کپی متن" onClick={(e) => copyFromCard(e, n)}>
                  <Icon name="note" size={16} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      {editor && (
        <NoteEditor
          key={editor.note?.id || "new"}
          kind={kind}
          L={L}
          mode={editor.mode}
          note={editor.note}
          projects={projects}
          onClose={() => setEditor(null)}
          onSaved={(n, isNew) => {
            applySaved(n, isNew);
            flash("ذخیره شد ✓");
          }}
          onDeleted={(id) => {
            setNotes((list) => list.filter((n) => n.id !== id));
            flash("حذف شد");
          }}
          onCopy={async (text) => flash((await copyText(text)) ? "کپی شد ✓" : "کپی انجام نشد")}
        />
      )}
    </>
  );
}

function NoteEditor({ kind, L, mode, note, projects, onClose, onSaved, onDeleted, onCopy }) {
  const isEdit = mode === "edit";
  const editable = isEdit ? note.canEdit : true;
  const isConfig = kind !== "note";

  const [form, setForm] = useState({
    title: note?.title || "",
    body: note?.body || "",
    tags: (note?.tags || []).join("، "),
    scope: note?.scope || (kind === "proxy" ? "workspace" : "private"),
    projectId: note?.projectId || projects[0]?.id || "",
    pinned: note?.pinned || false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { title: form.title, body: form.body, tags: form.tags, scope: form.scope, pinned: form.pinned };
      if (form.scope === "project") payload.projectId = form.projectId;
      const response = await fetch(isEdit ? `/api/notes/${note.id}` : "/api/notes", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? payload : { ...payload, kind }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ذخیره انجام نشد.");
      onSaved(data.note, !isEdit);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "حذف انجام نشد.");
      onDeleted(note.id);
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const footer = !editable ? (
    <>
      <button type="button" className="secondary-button" onClick={() => onCopy(form.body)}>کپی متن</button>
      <button type="button" className="primary-button" onClick={onClose}>بستن</button>
    </>
  ) : confirmDelete ? (
    <>
      <span className="confirm-text">حذف شود؟ این کار قابل بازگشت نیست.</span>
      <button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)} disabled={busy}>نه</button>
      <button type="button" className="danger-button danger-solid" onClick={remove} disabled={busy}>بله، حذف شود</button>
    </>
  ) : (
    <>
      {isEdit && <button type="button" className="danger-button footer-start" onClick={() => setConfirmDelete(true)} disabled={busy}>حذف</button>}
      <button type="button" className="secondary-button" onClick={() => onCopy(form.body)}>کپی متن</button>
      <button type="submit" form="note-form" className="primary-button" disabled={busy}>{busy ? "در حال ذخیره..." : "ذخیره"}</button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={isEdit ? L.title : L.add} size="lg" footer={footer}>
      <form id="note-form" className="form-grid" onSubmit={save}>
        <label className="field-wide">
          عنوان
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} disabled={!editable} placeholder={L.titlePh} autoFocus={!isEdit} />
        </label>

        <label className="field-wide">
          متن
          <textarea
            className={isConfig ? "mono" : ""}
            dir={isConfig ? "ltr" : undefined}
            spellCheck={!isConfig}
            rows={14}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            disabled={!editable}
            placeholder={L.bodyPh}
          />
        </label>

        <label className="field-wide">
          تگ‌ها (با ویرگول جدا کنید)
          <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} disabled={!editable} placeholder={kind === "proxy" ? "تلگرام، mtproto، آلمان" : isConfig ? "v2ray، آلمان، سرور-۱" : "جلسه، ایده"} />
        </label>

        <label>
          چه کسانی ببینند؟
          <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} disabled={!editable}>
            <option value="private">فقط خودم</option>
            <option value="workspace">همه اعضای فضای کاری</option>
            <option value="project" disabled={projects.length === 0}>اعضای یک پروژه</option>
          </select>
        </label>

        {form.scope === "project" ? (
          <label>
            پروژه
            <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} disabled={!editable}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        ) : (
          <label className="switch-row">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} disabled={!editable} />
            <span><strong>سنجاق شود</strong><small>در بالای فهرست نمایش داده می‌شود.</small></span>
          </label>
        )}

        {isConfig && form.scope !== "private" && (
          <p className="field-hint field-wide warn-hint">
            {kind === "proxy"
              ? "توجه: پروکسی برای همه‌ی افراد انتخاب‌شده قابل مشاهده و کپی است."
              : "هشدار: کانفیگ‌ها معمولاً شامل رمز یا کلید هستند. با گزینه‌ی غیرشخصی، دیگر اعضا هم متن را می‌بینند."}
          </p>
        )}
        {isEdit && !editable && <p className="field-hint field-wide">فقط سازنده می‌تواند این مورد را ویرایش کند ({note.ownerName}).</p>}
        {error && <div className="form-error field-wide">{error}</div>}
      </form>
    </Modal>
  );
}
