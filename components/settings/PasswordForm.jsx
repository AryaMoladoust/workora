"use client";

import { useState } from "react";
import Icon from "../ui/Icon";
import { useConfirm } from "../ui/Feedback";

export default function PasswordForm() {
  const confirm = useConfirm();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (form.newPassword !== form.confirm) {
      setError("تکرار رمز عبور با رمز جدید یکی نیست.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "رمز تغییر نکرد.");
      setSaved(true);
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOutOthers() {
    if (!(await confirm({ title: "خروج از دستگاه‌های دیگر", message: "از همه‌ی دستگاه‌های دیگر خارج می‌شوید (این دستگاه می‌ماند). ادامه می‌دهید؟", confirmLabel: "خروج از بقیه", danger: true }))) return;
    setSigningOut(true);
    setSignedOut(false);
    try {
      const response = await fetch("/api/profile/sessions", { method: "POST" });
      if (response.ok) setSignedOut(true);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <section className="card settings-card">
      <div className="card-head">
        <h2 className="card-title"><span className="card-title-icon"><Icon name="lock" size={17} /></span>رمز عبور و امنیت</h2>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label className="field-wide">رمز عبور فعلی<input type="password" dir="ltr" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required /></label>
        <label>رمز عبور جدید<input type="password" dir="ltr" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required /></label>
        <label>تکرار رمز جدید<input type="password" dir="ltr" autoComplete="new-password" minLength={8} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></label>
        <small className="field-hint field-wide">حداقل ۸ کاراکتر. بعد از تغییر رمز، همه‌ی دستگاه‌های دیگر از حساب خارج می‌شوند و این دستگاه می‌ماند.</small>
        {error && <div className="form-error field-wide">{error}</div>}
        {saved && <div className="auth-success field-wide" role="status">رمز عبور تغییر کرد.</div>}
        <div className="field-wide settings-actions"><button className="primary-button" disabled={busy}>{busy ? "در حال تغییر..." : "تغییر رمز عبور"}</button></div>
      </form>

      <div className="settings-divider" />
      <div className="settings-row">
        <div>
          <strong>خروج از همه‌ی دستگاه‌های دیگر</strong>
          <small>اگر جایی فراموش کرده‌اید از حساب خارج شوید، با این دکمه همه‌ی نشست‌های دیگر بسته می‌شود.</small>
        </div>
        <button type="button" className="secondary-button" onClick={signOutOthers} disabled={signingOut}>{signingOut ? "..." : "خروج از بقیه"}</button>
      </div>
      {signedOut && <div className="auth-success" role="status" style={{ marginTop: 12 }}>از همه‌ی دستگاه‌های دیگر خارج شدید.</div>}
    </section>
  );
}
