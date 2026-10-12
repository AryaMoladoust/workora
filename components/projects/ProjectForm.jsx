"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MemberPicker from "../ui/MemberPicker";
import { PROJECT_STATUS_LABELS } from "../../lib/format";

export default function ProjectForm({ mode, projectId, initial, members, currentUserId }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    status: initial?.status || "active",
    startAt: initial?.startAt || "",
    dueAt: initial?.dueAt || "",
    memberIds: initial?.memberIds || (currentUserId ? [currentUserId] : []),
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEdit = mode === "edit";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const response = await fetch(isEdit ? `/api/projects/${projectId}` : "/api/projects", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          status: form.status,
          startAt: form.startAt || null,
          dueAt: form.dueAt || null,
          ...(isEdit ? {} : { memberIds: form.memberIds }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ذخیره پروژه انجام نشد.");
      if (isEdit) {
        setSaved(true);
        router.refresh();
      } else {
        router.push(`/projects/${data.project.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card form-grid project-form" onSubmit={submit}>
      <label className="field-wide">
        نام پروژه
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={160} placeholder="مثلاً بازطراحی وب‌سایت" />
      </label>

      <label className="field-wide">
        توضیحات
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} maxLength={5000} placeholder="هدف و دامنه پروژه را کوتاه بنویسید" />
      </label>

      {isEdit && (
        <label>
          وضعیت
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      )}

      <label>
        تاریخ شروع
        <input type="date" dir="ltr" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
      </label>
      <label>
        مهلت پروژه
        <input type="date" dir="ltr" value={form.dueAt} min={form.startAt || undefined} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
      </label>

      {!isEdit && (
        <div className="field-wide">
          <span className="field-label">اعضای پروژه</span>
          <MemberPicker
            members={members}
            selected={form.memberIds}
            onChange={(memberIds) => setForm({ ...form, memberIds })}
            lockedIds={currentUserId ? [currentUserId] : []}
          />
          <small className="field-hint">فقط اعضای پروژه آن را می‌بینند (مالک و مدیران پروژه همه پروژه‌ها را می‌بینند).</small>
        </div>
      )}

      {error && <div className="form-error field-wide">{error}</div>}
      {saved && <div className="form-success field-wide">تغییرات ذخیره شد.</div>}

      <div className="form-actions field-wide">
        <button className="primary-button" disabled={loading}>
          {loading ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ایجاد پروژه"}
        </button>
        {!isEdit && (
          <button type="button" className="secondary-button" onClick={() => router.back()}>انصراف</button>
        )}
      </div>
    </form>
  );
}
