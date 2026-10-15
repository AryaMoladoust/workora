"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";

export default function ProfileForm({ initial }) {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: initial.firstName, lastName: initial.lastName, phone: initial.phone || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ذخیره نشد.");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card settings-card">
      <div className="card-head">
        <h2 className="card-title"><span className="card-title-icon"><Icon name="users" size={17} /></span>پروفایل</h2>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>نام<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></label>
        <label>نام خانوادگی<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></label>
        <label>ایمیل<input dir="ltr" value={initial.email} disabled /><small className="field-hint">ایمیل ورود قابل تغییر نیست.</small></label>
        <label>تلفن (اختیاری)<input dir="ltr" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        {error && <div className="form-error field-wide">{error}</div>}
        {saved && <div className="auth-success field-wide" role="status">تغییرات ذخیره شد.</div>}
        <div className="field-wide settings-actions"><button className="primary-button" disabled={busy}>{busy ? "در حال ذخیره..." : "ذخیره تغییرات"}</button></div>
      </form>
    </section>
  );
}
