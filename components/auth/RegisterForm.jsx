"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterForm({ needsKey }) {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", workspaceName: "", registrationKey: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        <h1>ساخت فضای کاری</h1>
        <p>حساب مالک Workspace را ایجاد کنید. اعضای تیم را بعداً از بخش «اعضا» اضافه می‌کنید.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <div className="auth-grid">
          <label>نام<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></label>
          <label>نام خانوادگی<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></label>
        </div>
        <label>ایمیل<input type="email" dir="ltr" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>نام Workspace<input value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} required /></label>
        <label>
          رمز عبور
          <input type="password" dir="ltr" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <small>حداقل ۸ کاراکتر</small>
        </label>
        {needsKey && (
          <label>
            کد دعوت
            <input dir="ltr" value={form.registrationKey} onChange={(e) => setForm({ ...form, registrationKey: e.target.value })} required />
            <small>مقدار متغیر REGISTRATION_KEY که در تنظیمات سرور گذاشته‌اید.</small>
          </label>
        )}
        <button className="primary-button" disabled={loading}>{loading ? "در حال ساخت..." : "ساخت Workspace"}</button>
        <Link href="/login" className="auth-link">قبلاً حساب ساخته‌اید؟ ورود</Link>
      </form>
    </main>
  );
}
