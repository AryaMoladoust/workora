"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import { PERMISSIONS } from "../../lib/permissions";
import { initials, hueFromString } from "../../lib/format";

const EMPTY_FORM = { firstName: "", lastName: "", email: "", phone: "", password: "", permissions: [] };

function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

function PermissionList({ value, onChange, allowed, disabled }) {
  function toggle(id) {
    onChange(value.includes(id) ? value.filter((p) => p !== id) : [...value, id]);
  }
  return (
    <div className="perm-list">
      {PERMISSIONS.map((p) => {
        const canGrant = allowed.includes(p.id);
        const checked = value.includes(p.id);
        return (
          <label key={p.id} className={`perm-item ${checked ? "is-checked" : ""} ${!canGrant && !checked ? "is-disabled" : ""}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled || (!canGrant && !checked)}
              onChange={() => toggle(p.id)}
            />
            <span>
              <strong>{p.label}</strong>
              <small>{p.description}</small>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function MembersManager({ members, canManage, currentUserId, grantable }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "active" && !m.isActive) return false;
      if (filter === "inactive" && m.isActive) return false;
      if (!q) return true;
      return `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q);
    });
  }, [members, query, filter]);

  const counts = {
    all: members.length,
    active: members.filter((m) => m.isActive).length,
    inactive: members.filter((m) => !m.isActive).length,
  };

  function openAdd() {
    setForm(EMPTY_FORM);
    setError("");
    setAddOpen(true);
  }

  function openEdit(member) {
    setEditing(member);
    setEditForm({
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      permissions: member.permissions,
      isActive: member.isActive,
      password: "",
    });
    setError("");
  }

  async function request(url, method, body) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "عملیات انجام نشد.");
    return data;
  }

  async function submitAdd(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request("/api/members", "POST", form);
      setAddOpen(false);
      setNotice(`«${data.member.firstName} ${data.member.lastName}» اضافه شد. ایمیل و رمز موقت را به خودش بدهید.`);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
      };
      if (editing.role !== "owner") body.permissions = editForm.permissions;
      if (editing.role !== "owner" && editing.userId !== currentUserId) body.isActive = editForm.isActive;
      if (editForm.password) body.password = editForm.password;
      await request(`/api/members/${editing.membershipId}`, "PATCH", body);
      setEditing(null);
      setNotice("تغییرات ذخیره شد.");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const editingIsOwner = editing?.role === "owner";
  const editingIsSelf = editing?.userId === currentUserId;

  return (
    <>
      {notice && (
        <div className="notice" role="status">
          <Icon name="check" size={18} />
          <span>{notice}</span>
          <button type="button" className="notice-close" aria-label="بستن" onClick={() => setNotice("")}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input type="search" placeholder="جستجوی نام یا ایمیل..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="filter-tabs" role="tablist">
          {[
            ["all", "همه"],
            ["active", "فعال"],
            ...(canManage ? [["inactive", "غیرفعال"]] : []),
          ].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>
              {label}
              <span>{counts[id].toLocaleString("fa-IR")}</span>
            </button>
          ))}
        </div>
        {canManage && (
          <button type="button" className="primary-button" onClick={openAdd}>
            <Icon name="plus" size={18} />
            عضو جدید
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <h2>عضوی پیدا نشد</h2>
          <p>عبارت جستجو یا فیلتر را تغییر دهید.</p>
        </div>
      ) : (
        <div className="member-grid">
          {visible.map((m) => (
            <article key={m.membershipId} className={`member-card ${m.isActive ? "" : "is-inactive"}`}>
              <div className="member-top">
                <span className="avatar avatar-lg" style={{ "--h": hueFromString(m.userId) }}>{initials(m.firstName, m.lastName)}</span>
                <div className="member-id">
                  <strong>{m.firstName} {m.lastName}</strong>
                  <small dir="ltr">{m.email}</small>
                </div>
                <span className={`chip ${m.role === "owner" ? "chip-owner" : "chip-member"}`}>{m.role === "owner" ? "مالک" : "عضو"}</span>
              </div>

              <dl className="member-meta">
                <div><dt>پروژه‌ها</dt><dd>{m.projectCount.toLocaleString("fa-IR")}</dd></div>
                {canManage && <div><dt>آخرین ورود</dt><dd>{m.lastLoginText || "—"}</dd></div>}
                {canManage && m.phone && <div><dt>تلفن</dt><dd dir="ltr">{m.phone}</dd></div>}
              </dl>

              {canManage && (
                <div className="member-perms">
                  {m.role === "owner" ? (
                    <span className="chip chip-owner">همه دسترسی‌ها</span>
                  ) : m.permissions.length === 0 ? (
                    <span className="chip">بدون دسترسی مدیریتی</span>
                  ) : (
                    m.permissions.map((id) => (
                      <span className="chip chip-member" key={id}>{PERMISSIONS.find((p) => p.id === id)?.label || id}</span>
                    ))
                  )}
                </div>
              )}

              <footer className="member-foot">
                {!m.isActive && <span className="chip chip-off">غیرفعال</span>}
                {canManage && (
                  <button type="button" className="secondary-button member-edit" onClick={() => openEdit(m)}>
                    ویرایش
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      {/* ---- add member ---- */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="افزودن عضو جدید"
        size="lg"
        footer={
          <>
            <button type="button" className="secondary-button" onClick={() => setAddOpen(false)}>انصراف</button>
            <button type="submit" form="add-member-form" className="primary-button" disabled={busy}>{busy ? "در حال ساخت..." : "ساخت حساب"}</button>
          </>
        }
      >
        <form id="add-member-form" className="form-grid" onSubmit={submitAdd}>
          <label>نام<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></label>
          <label>نام خانوادگی<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></label>
          <label>ایمیل (برای ورود)<input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>تلفن (اختیاری)<input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="field-wide">
            رمز موقت
            <div className="input-with-action">
              <input dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
              <button type="button" className="secondary-button" onClick={() => setForm({ ...form, password: randomPassword() })}>ساخت رمز تصادفی</button>
            </div>
            <small className="field-hint">حداقل ۸ کاراکتر. رمز را برای کاربر یادداشت کنید؛ بعد از ساخت قابل نمایش نیست.</small>
          </label>
          <div className="field-wide">
            <span className="field-label">دسترسی‌ها</span>
            <PermissionList value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} allowed={grantable} />
          </div>
          {error && <div className="form-error field-wide">{error}</div>}
        </form>
      </Modal>

      {/* ---- edit member ---- */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `ویرایش ${editing.firstName} ${editing.lastName}` : ""}
        size="lg"
        footer={
          <>
            <button type="button" className="secondary-button" onClick={() => setEditing(null)}>انصراف</button>
            <button type="submit" form="edit-member-form" className="primary-button" disabled={busy}>{busy ? "در حال ذخیره..." : "ذخیره تغییرات"}</button>
          </>
        }
      >
        {editing && editForm && (
          <form id="edit-member-form" className="form-grid" onSubmit={submitEdit}>
            <label>نام<input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required /></label>
            <label>نام خانوادگی<input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} required /></label>
            <label>ایمیل<input dir="ltr" value={editing.email} disabled /></label>
            <label>تلفن<input dir="ltr" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></label>

            {(!editingIsOwner || editingIsSelf) && (
              <label className="field-wide">
                رمز عبور جدید (اختیاری)
                <div className="input-with-action">
                  <input dir="ltr" value={editForm.password} minLength={8} placeholder="برای تغییر رمز وارد کنید" onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                  <button type="button" className="secondary-button" onClick={() => setEditForm({ ...editForm, password: randomPassword() })}>رمز تصادفی</button>
                </div>
              </label>
            )}

            <div className="field-wide">
              <span className="field-label">دسترسی‌ها</span>
              {editingIsOwner ? (
                <p className="field-hint">مالک همیشه به همه بخش‌ها دسترسی دارد.</p>
              ) : (
                <PermissionList value={editForm.permissions} onChange={(permissions) => setEditForm({ ...editForm, permissions })} allowed={grantable} />
              )}
            </div>

            {!editingIsOwner && !editingIsSelf && (
              <label className="switch-row field-wide">
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                <span>
                  <strong>حساب فعال است</strong>
                  <small>اگر غیرفعال شود، کاربر دیگر نمی‌تواند وارد شود. اطلاعات و سوابقش حذف نمی‌شود.</small>
                </span>
              </label>
            )}
            {error && <div className="form-error field-wide">{error}</div>}
          </form>
        )}
      </Modal>
    </>
  );
}
