"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OtpVerify from "./OtpVerify";
import PenLoader from "../loading/PenLoader";

// mode "owner": first registration, creates the workspace.
// mode "request": team member enters their (Gmail) e-mail and waits for the owner's approval.
export default function RegisterForm({ mode: initialMode, needsKey = false, canRequest = false, domainHint = "", mailEnabled = false }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState("form"); // request mode: "form" → "verify" (4-digit code)
  const [resendIn, setResendIn] = useState(600);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", workspaceName: "", registrationKey: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isRequest = mode === "request";
  const emailLabel = isRequest && domainHint ? `ایمیل ${domainHint}` : "ایمیل";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = isRequest
        ? { signupRequest: true, firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password }
        : { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, workspaceName: form.workspaceName, registrationKey: form.registrationKey };
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ثبت‌نام انجام نشد.");
      if (data.step === "verify") {
        setResendIn(data.resendIn || 600);
        setStep("verify");
        setLoading(false);
        return;
      }
      router.replace("/dashboard"); // the loader stays until the dashboard replaces this page
      router.refresh();
    } catch (e) {
      setError(e.message);
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
          <OtpVerify email={form.email.trim().toLowerCase()} initialCooldown={resendIn} mailEnabled={mailEnabled} onBack={() => setStep("form")} />
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
        <h1>{isRequest ? "درخواست ثبت‌نام" : "ساخت فضای کاری"}</h1>
        <p>
          {isRequest
            ? `ایمیل ${domainHint || ""} خودتان را وارد کنید. یک کد ۴ رقمی به آن ایمیل می‌فرستیم و بعد از تایید ایمیل، مالک فضای کاری درخواستتان را بررسی می‌کند.`
            : "حساب مالک Workspace را ایجاد کنید. اعضای تیم با «درخواست ثبت‌نام» یا از بخش «اعضا» اضافه می‌شوند."}
        </p>
        {error && <div className="auth-error" role="alert">{error}</div>}


        <div className="auth-grid">
          <label>نام<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></label>
          <label>نام خانوادگی<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></label>
        </div>
        <label>
          {emailLabel}
          <input type="email" dir="ltr" autoComplete="email" placeholder={isRequest && domainHint === "Gmail" ? "name@gmail.com" : undefined} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        {!isRequest && (
          <label>نام Workspace<input value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} required /></label>
        )}
        <label>
          رمز عبور
          <input type="password" dir="ltr" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <small>حداقل ۸ کاراکتر</small>
        </label>
        {needsKey && (
          <label>
            کد دعوت سرور (REGISTRATION_KEY)
            <input dir="ltr" value={form.registrationKey} onChange={(e) => setForm({ ...form, registrationKey: e.target.value })} required />
            <small>مقداری که در تنظیمات Vercel گذاشته‌اید.</small>
          </label>
        )}
        <button className="primary-button" disabled={loading}>{loading ? "در حال ارسال..." : isRequest ? "ارسال کد تایید" : "ساخت Workspace"}</button>
        <Link href="/login" className="auth-link">قبلاً حساب ساخته‌اید؟ ورود</Link>
      </form>
      {loading && <PenLoader blocking delay={0.05} />}
    </main>
  );
}
