"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PenLoader from "../loading/PenLoader";

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
      setLoading(false); // on success the loader stays until the dashboard replaces this page
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
        <Link href="/forgot-password" className="auth-link auth-forgot">رمز عبور را فراموش کرده‌اید؟</Link>
        <button className="primary-button" disabled={loading}>{loading ? "در حال ورود..." : "ورود"}</button>
        <div className="auth-divider"><span>حساب ندارید؟</span></div>
        <Link href="/register" className="secondary-button auth-register">ثبت‌نام</Link>
        <small className="auth-note">بعد از ثبت‌نام باید مالک فضای کاری درخواستتان را تایید کند (یا با کد دعوت مستقیم وارد شوید).</small>
      </form>
      {loading && <PenLoader blocking delay={0.05} />}
    </main>
  );
}
