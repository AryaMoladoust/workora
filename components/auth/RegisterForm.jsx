"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// mode "owner": first registration, creates the workspace.  mode "join": team member with an invite code.
export default function RegisterForm({ mode, needsKey = false, initialCode = "" }) {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", workspaceName: "", registrationKey: "", inviteCode: initialCode });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isJoin = mode === "join";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = isJoin
        ? { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, inviteCode: form.inviteCode }
        : { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, workspaceName: form.workspaceName, registrationKey: form.registrationKey };
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ثبت‌نام انجام نشد.");
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-brand">Workora</span>
        <h1>{isJoin ? "ثبت‌نام در تیم" : "ساخت فضای کاری"}</h1>
        <p>
          {isJoin
            ? "کد دعوت را از مالک فضای کاری بگیرید و حساب خودتان را بسازید."
            : "حساب مالک Workspace را ایجاد کنید. اعضای تیم با «کد دعوت» یا از بخش «اعضا» اضافه می‌شوند."}
        </p>
        {error && <div className="auth-error" role="alert">{error}</div>}

        {isJoin && (
          <label>
            کد دعوت
            <input dir="ltr" className="code-input" placeholder="XXXXX-XXXXX" value={form.inviteCode} onChange={(e) => setForm({ ...form, inviteCode: e.target.value })} required />
          </label>
        )}

        <div className="auth-grid">
          <label>نام<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></label>
          <label>نام خانوادگی<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></label>
        </div>
        <label>ایمیل<input type="email" dir="ltr" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        {!isJoin && (
          <label>نام Workspace<input value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} required /></label>
        )}
        <label>
          رمز عبور
          <input type="password" dir="ltr" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <small>حداقل ۸ کاراکتر</small>
        </label>
        {!isJoin && needsKey && (
          <label>
            کد دعوت سرور (REGISTRATION_KEY)
            <input dir="ltr" value={form.registrationKey} onChange={(e) => setForm({ ...form, registrationKey: e.target.value })} required />
            <small>مقداری که در تنظیمات Vercel گذاشته‌اید.</small>
          </label>
        )}
        <button className="primary-button" disabled={loading}>{loading ? "در حال ثبت‌نام..." : isJoin ? "ثبت‌نام و ورود" : "ساخت Workspace"}</button>
        <Link href="/login" className="auth-link">قبلاً حساب ساخته‌اید؟ ورود</Link>
      </form>
    </main>
  );
}
