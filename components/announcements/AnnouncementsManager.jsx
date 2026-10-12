"use client";

import { useState } from "react";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";

export default function AnnouncementsManager({ initialItems, canPost }) {
  const [items, setItems] = useState(initialItems);
  const [editor, setEditor] = useState(null); // { item? }
  const [form, setForm] = useState({ title: "", body: "", pinned: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  function openEditor(item) {
    setForm(item ? { title: item.title, body: item.body, pinned: item.pinned } : { title: "", body: "", pinned: false });
    setError("");
    setEditor({ item });
  }

  function sorted(list) {
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const isEdit = Boolean(editor.item);
      const response = await fetch(isEdit ? `/api/announcements/${editor.item.id}` : "/api/announcements", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ذخیره انجام نشد.");
      setItems((list) => sorted(isEdit ? list.map((i) => (i.id === data.announcement.id ? data.announcement : i)) : [data.announcement, ...list]));
      setEditor(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    const response = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    if (response.ok) setItems((list) => list.filter((i) => i.id !== id));
    setConfirmId(null);
  }

  async function togglePin(item) {
    const response = await fetch(`/api/announcements/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !item.pinned }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setItems((list) => sorted(list.map((i) => (i.id === item.id ? data.announcement : i))));
  }

  return (
    <>
      {canPost && (
        <div className="toolbar">
          <button type="button" className="primary-button" onClick={() => openEditor(null)}>
            <Icon name="plus" size={18} />
            اطلاعیه جدید
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>هنوز اطلاعیه‌ای منتشر نشده</h2>
          <p>{canPost ? "اولین اطلاعیه را برای کل تیم منتشر کنید؛ همه اعضا اعلان می‌گیرند." : "وقتی اطلاعیه‌ای منتشر شود اینجا نمایش داده می‌شود."}</p>
        </div>
      ) : (
        <div className="announce-list">
          {items.map((a) => (
            <article key={a.id} className={`announce ${a.pinned ? "is-pinned" : ""}`}>
              <header>
                <span className="announce-icon"><Icon name="megaphone" size={20} /></span>
                <div className="announce-title">
                  <h3>{a.title}</h3>
                  <small>{a.authorName} · {a.createdText}</small>
                </div>
                {a.pinned && <span className="chip chip-owner">سنجاق‌شده</span>}
                {a.canEdit && (
                  <div className="announce-actions">
                    <button type="button" className="link-button" onClick={() => togglePin(a)}>{a.pinned ? "برداشتن سنجاق" : "سنجاق"}</button>
                    <button type="button" className="link-button" onClick={() => openEditor(a)}>ویرایش</button>
                    {confirmId === a.id ? (
                      <>
                        <button type="button" className="link-button danger-link" onClick={() => remove(a.id)}>تأیید حذف</button>
                        <button type="button" className="link-button" onClick={() => setConfirmId(null)}>نه</button>
                      </>
                    ) : (
                      <button type="button" className="link-button danger-link" onClick={() => setConfirmId(a.id)}>حذف</button>
                    )}
                  </div>
                )}
              </header>
              <p className="announce-body">{a.body}</p>
            </article>
          ))}
        </div>
      )}

      {editor && (
        <Modal
          open
          onClose={() => setEditor(null)}
          title={editor.item ? "ویرایش اطلاعیه" : "اطلاعیه جدید"}
          size="lg"
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setEditor(null)}>انصراف</button>
              <button type="submit" form="announce-form" className="primary-button" disabled={busy}>{busy ? "در حال ذخیره..." : editor.item ? "ذخیره" : "انتشار"}</button>
            </>
          }
        >
          <form id="announce-form" className="form-grid" onSubmit={save}>
            <label className="field-wide">عنوان<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} autoFocus /></label>
            <label className="field-wide">متن اطلاعیه<textarea rows={9} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required maxLength={10000} /></label>
            <label className="switch-row field-wide">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              <span><strong>سنجاق شود</strong><small>در بالای فهرست و روی داشبورد نمایش داده می‌شود.</small></span>
            </label>
            {!editor.item && <p className="field-hint field-wide">با انتشار، برای همه‌ی اعضای فعال اعلان ارسال می‌شود.</p>}
            {error && <div className="form-error field-wide">{error}</div>}
          </form>
        </Modal>
      )}
    </>
  );
}
