"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// mode "owner": first registration, creates the workspace.
// mode "join": team member with an invite code (instant access).
// mode "request": team member enters their (Gmail) e-mail and waits for the owner's approval.
export default function RegisterForm({ mode: initialMode, needsKey = false, initialCode = "", canRequest = false, domainHint = "", mailEnabled = false }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", workspaceName: "", registrationKey: "", inviteCode: initialCode });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isJoin = mode === "join";
  const isRequest = mode === "request";
  const emailLabel = isRequest && domainHint ? `ایمیل ${domainHint}` : "ایمیل";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = isRequest
        ? { signupRequest: true, firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password }
        : isJoin
        ? { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, inviteCode: form.inviteCode }
        : { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, workspaceName: form.workspaceName, registrationKey: form.registrationKey };
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ثبت‌نام انجام نشد.");
      if (data.pending) {
        setSubmitted(true);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <span className="auth-brand">
            <img src="/logo.png" alt="" width="36" height="36" />
            Workora
          </span>
          <h1>درخواست شما ثبت شد</h1>
          <div className="auth-success" role="status">
            ایمیل <strong dir="ltr">{form.email}</strong> برای بررسی به مالک فضای کاری رسید. بعد از تایید او می‌توانید با همین ایمیل و رمز عبور وارد شوید.
          </div>
          <p>
            {mailEnabled
              ? "به‌محض تایید، یک ایمیل اطلاع‌رسانی برایتان ارسال می‌شود (پوشه‌ی Spam را هم نگاه کنید). تا آن موقع امکان ورود وجود ندارد."
              : "تا قبل از تایید امکان ورود وجود ندارد؛ از مالک بخواهید درخواست را تایید کند و بعد وارد شوید."}
          </p>
          <Link href="/login" className="secondary-button auth-register">رفتن به صفحه ورود</Link>
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
        <h1>{isRequest ? "درخواست ثبت‌نام" : isJoin ? "ثبت‌نام در تیم" : "ساخت فضای کاری"}</h1>
        <p>
          {isRequest
            ? `ایمیل ${domainHint || ""} خودتان را وارد کنید. بعد از اینکه مالک فضای کاری درخواست را تایید کرد، می‌توانید وارد شوید.`
            : isJoin
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
        <label>
          {emailLabel}
          <input type="email" dir="ltr" autoComplete="email" placeholder={isRequest && domainHint === "Gmail" ? "name@gmail.com" : undefined} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        {!isJoin && !isRequest && (
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
        <button className="primary-button" disabled={loading}>{loading ? "در حال ثبت..." : isRequest ? "ارسال درخواست ثبت‌نام" : isJoin ? "ثبت‌نام و ورود" : "ساخت Workspace"}</button>
        {canRequest && isRequest && (
          <button type="button" className="auth-link auth-link-button" onClick={() => { setError(""); setMode("join"); }}>کد دعوت دارید؟ ثبت‌نام با کد</button>
        )}
        {canRequest && isJoin && (
          <button type="button" className="auth-link auth-link-button" onClick={() => { setError(""); setMode("request"); }}>کد دعوت ندارید؟ درخواست ثبت‌نام بدهید</button>
        )}
        <Link href="/login" className="auth-link">قبلاً حساب ساخته‌اید؟ ورود</Link>
      </form>
    </main>
  );
}
