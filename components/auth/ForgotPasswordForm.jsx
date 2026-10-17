"use client";

import { useState } from "react";
import Link from "next/link";
import OtpVerify from "./OtpVerify";
import PenLoader from "../loading/PenLoader";

const SUCCESS = {
  title: "رمز عبور تغییر کرد",
  text: "رمز جدید شما فعال شد.",
  note: "حالا با ایمیل و رمز جدیدتان وارد شوید. اگر در دستگاه دیگری وارد بودید، آنجا از حساب خارج شده‌اید.",
  href: "/login",
  label: "ورود به حساب",
};

// Forgot password: e-mail + new password → 6-digit code sent to that e-mail → password changes.
export default function ForgotPasswordForm() {
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [step, setStep] = useState("form");
  const [resendIn, setResendIn] = useState(600);
  const [length, setLength] = useState(6);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("تکرار رمز عبور با رمز جدید یکی نیست.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ارسال کد انجام نشد.");
      setResendIn(data.resendIn || 600);
      setLength(data.length || 6);
      setStep("verify");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <main className="auth-page">
        <div className="auth-card otp-card">
          <span className="auth-brand">
            <img src="/logo.png" alt="" width="36" height="36" />
            Workora
          </span>
          <OtpVerify
            email={form.email.trim().toLowerCase()}
            length={length}
            initialCooldown={resendIn}
            verifyUrl="/api/auth/reset-password"
            resendUrl="/api/auth/resend-reset-code"
            success={SUCCESS}
            onBack={() => setStep("form")}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-brand">
          <img src="/logo.png" alt="" width="36" height="36" />
          Workora
        </span>
        <h1>فراموشی رمز عبور</h1>
        <p>ایمیل حسابتان و رمز جدید را وارد کنید. یک کد ۶ رقمی به ایمیلتان می‌فرستیم و بعد از وارد کردن آن رمز تغییر می‌کند.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <label>
          ایمیل
          <input type="email" dir="ltr" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label>
          رمز عبور جدید
          <input type="password" dir="ltr" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </label>
        <label>
          تکرار رمز عبور جدید
          <input type="password" dir="ltr" autoComplete="new-password" minLength={8} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
        </label>
        <button className="primary-button" disabled={loading}>{loading ? "در حال ارسال..." : "ارسال کد تایید"}</button>
        <Link href="/login" className="auth-link">بازگشت به ورود</Link>
      </form>
      {loading && <PenLoader blocking delay={0.05} />}
    </main>
  );
}
