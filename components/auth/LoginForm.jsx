"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ورود انجام نشد.");
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
        <span className="auth-brand">
          <img src="/logo.png" alt="" width="36" height="36" />
          Workora
        </span>
        <h1>ورود</h1>
        <p>وارد حساب Workora شوید.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <label>
          ایمیل
          <input type="email" dir="ltr" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label>
          رمز عبور
          <input type="password" dir="ltr" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </label>
        <button className="primary-button" disabled={loading}>{loading ? "در حال ورود..." : "ورود"}</button>
        <div className="auth-divider"><span>حساب ندارید؟</span></div>
        <Link href="/register" className="secondary-button auth-register">ثبت‌نام با کد دعوت</Link>
        <small className="auth-note">کد دعوت را مالک فضای کاری به شما می‌دهد.</small>
      </form>
    </main>
  );
}
