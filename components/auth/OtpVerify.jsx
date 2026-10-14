"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// where each box flies in from on the intro animation
const SCATTER = [
  { sx: "-70px", sy: "-90px", sr: "-24deg" },
  { sx: "40px", sy: "70px", sr: "18deg" },
  { sx: "-30px", sy: "80px", sr: "-14deg" },
  { sx: "80px", sy: "-70px", sr: "26deg" },
];
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const toDigits = (value) => String(value || "").replace(/[۰-۹]/g, (c) => String(PERSIAN.indexOf(c))).replace(/\D/g, "");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Step 2 of a sign-up request: enter the 4-digit code sent by e-mail.
// input (boxes fly in) → verifying (the 4 boxes orbit around each other) → success (boxes merge into a check).
export default function OtpVerify({ email, initialCooldown = 60, mailEnabled = false, onBack }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [phase, setPhase] = useState("input");
  const [stageKey, setStageKey] = useState(0); // remounting the stage replays the intro animation after a wrong code
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [shake, setShake] = useState(false);
  const [expired, setExpired] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [resending, setResending] = useState(false);
  const refs = useRef([]);
  const alive = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    const timer = setTimeout(() => refs.current[0]?.focus(), 950); // after the boxes landed
    return () => clearTimeout(timer);
  }, []);

  // verify automatically as soon as the 4th digit is in
  useEffect(() => {
    if (phase === "input" && digits.every(Boolean)) verify(digits.join(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  async function verify(code) {
    if (busy.current) return;
    busy.current = true;
    setPhase("verifying");
    setError("");
    setInfo("");
    refs.current.forEach((el) => el && el.blur());

    const started = Date.now();

    let ok = false;
    let data = {};
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      data = await response.json().catch(() => ({}));
      ok = response.ok;
    } catch {
      data = { error: "اتصال به سرور برقرار نشد." };
    }

    await sleep(Math.max(0, 2300 - (Date.now() - started))); // let the boxes complete their orbit
    if (!alive.current) {
      busy.current = false;
      return;
    }

    if (ok) {
      setPhase("success");
    } else {
      setError(data.error || "تایید انجام نشد.");
      setExpired(Boolean(data.expired));
      setDigits(["", "", "", ""]);
      setStageKey((k) => k + 1);
      setPhase("input");
      setShake(true);
      setTimeout(() => alive.current && setShake(false), 600);
      setTimeout(() => refs.current[0]?.focus(), 60);
    }
    busy.current = false;
  }

  function fill(start, text) {
    const next = [...digits];
    let i = start;
    for (const ch of text.slice(0, 4 - start)) next[i++] = ch;
    setDigits(next);
    refs.current[Math.min(i, 3)]?.focus();
  }

  function onChange(i, raw) {
    setError("");
    const d = toDigits(raw);
    if (!d) {
      setDigits((prev) => prev.map((v, k) => (k === i ? "" : v)));
      return;
    }
    fill(i, d.slice(-1));
  }

  function onKeyDown(i, event) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[i]) setDigits((prev) => prev.map((v, k) => (k === i ? "" : v)));
      else if (i > 0) {
        setDigits((prev) => prev.map((v, k) => (k === i - 1 ? "" : v)));
        refs.current[i - 1]?.focus();
      }
    } else if (event.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (event.key === "ArrowRight" && i < 3) refs.current[i + 1]?.focus();
  }

  function onPaste(event) {
    event.preventDefault();
    const d = toDigits(event.clipboardData.getData("text")).slice(0, 4);
    if (!d) return;
    const next = ["", "", "", ""];
    [...d].forEach((ch, k) => (next[k] = ch));
    setError("");
    setDigits(next);
    refs.current[Math.min(d.length, 3)]?.focus();
  }

  async function resend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "ارسال نشد.");
        if (data.retryAfterSec) setCooldown(data.retryAfterSec);
        if (data.expired) setExpired(true);
      } else {
        setInfo("کد جدید به ایمیل شما ارسال شد.");
        setCooldown(data.resendIn || 60);
        setDigits(["", "", "", ""]);
        setTimeout(() => refs.current[0]?.focus(), 50);
      }
    } catch {
      setError("اتصال به سرور برقرار نشد.");
    } finally {
      setResending(false);
    }
  }

  const verifying = phase === "verifying";
  const success = phase === "success";
  const stageClass = `otp-stage${verifying ? " is-orbit" : success ? " is-orbit is-merge is-success" : ""}${shake ? " otp-shake" : ""}${error ? " otp-error" : ""}`;

  return (
    <div className="otp-wrap" aria-live="polite">
      <h1>{success ? "ایمیل شما تایید شد" : verifying ? "در حال بررسی..." : "کد تایید را وارد کنید"}</h1>
      {success ? (
        <p>درخواست شما برای تایید به مالک فضای کاری رسید.</p>
      ) : verifying ? (
        <p>کد شما به‌صورت امن بررسی می‌شود.</p>
      ) : (
        <p>
          کد ۴ رقمی به <strong dir="ltr">{email}</strong> ارسال شد.
        </p>
      )}

      <div className={stageClass} key={stageKey} dir="ltr">
        <span className="otp-orbit-ring" aria-hidden="true" />
        <span className="otp-core" aria-hidden="true" />
        <div className="otp-group">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              className={`otp-box${d ? " filled" : ""}`}
              style={{ "--i": i, "--sx": SCATTER[i].sx, "--sy": SCATTER[i].sy, "--sr": SCATTER[i].sr }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={d}
              readOnly={phase !== "input"}
              tabIndex={phase === "input" ? 0 : -1}
              aria-label={`رقم ${i + 1} از ۴`}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={onPaste}
              onFocus={(e) => e.target.select()}
            />
          ))}
        </div>
        <div className="otp-check" aria-hidden="true">
          <span className="otp-ripple" />
          <span className="otp-ripple otp-ripple-2" />
          <svg viewBox="0 0 52 52"><path d="M14 27 l8 8 l16 -17" /></svg>
        </div>
      </div>

      {phase === "input" && (
        <>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {info && <div className="auth-success" role="status">{info}</div>}
          <div className="otp-resend">
            <span>کد را دریافت نکردید؟</span>
            <button type="button" className="otp-resend-btn" onClick={resend} disabled={cooldown > 0 || resending}>
              {resending ? "در حال ارسال..." : cooldown > 0 ? `ارسال مجدد (${cooldown})` : "ارسال مجدد"}
            </button>
          </div>
          <small className="otp-hint">پوشه‌ی Spam را هم نگاه کنید. کد ۱۰ دقیقه معتبر است.</small>
          <button type="button" className="auth-link auth-link-button" onClick={onBack}>
            {expired ? "شروع دوباره" : "ویرایش ایمیل"}
          </button>
        </>
      )}

      {success && (
        <div className="otp-done">
          <div className="auth-success" role="status">
            {mailEnabled
              ? "به‌محض اینکه مالک تایید کند، یک ایمیل اطلاع‌رسانی برایتان می‌آید (پوشه‌ی Spam را هم نگاه کنید). بعد از آن با ایمیل و رمز عبورتان وارد شوید."
              : "بعد از تایید مالک می‌توانید با ایمیل و رمز عبورتان وارد شوید."}
          </div>
          <Link href="/login" className="secondary-button auth-register">رفتن به صفحه ورود</Link>
        </div>
      )}
    </div>
  );
}
