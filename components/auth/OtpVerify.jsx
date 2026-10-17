"use client";

import { useEffect, useRef, useState } from "react";
import PenLoader from "../loading/PenLoader";
import Link from "next/link";

// where each box flies in from on the intro animation
const SCATTER = [
  { sx: "-70px", sy: "-90px", sr: "-24deg" },
  { sx: "40px", sy: "70px", sr: "18deg" },
  { sx: "-30px", sy: "80px", sr: "-14deg" },
  { sx: "80px", sy: "-70px", sr: "26deg" },
];
// Row position and orbit position of box i out of n (evenly spaced on a circle, first one at the top).
function positions(i, n) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return {
    "--rx": `calc((var(--box-w) + var(--gap)) * ${i - (n - 1) / 2})`,
    "--ox": `calc(var(--r) * ${Math.cos(angle).toFixed(4)})`,
    "--oy": `calc(var(--r) * ${Math.sin(angle).toFixed(4)})`,
  };
}
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const toDigits = (value) => String(value || "").replace(/[۰-۹]/g, (c) => String(PERSIAN.indexOf(c))).replace(/\D/g, "");
const clock = (total) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Enter the code sent by e-mail (4 digits for sign-up, 6 for password reset).
// input (boxes fly in) → verifying (the boxes orbit around each other) → success (boxes merge into a check).
const DEFAULT_SUCCESS = {
  title: "ایمیل شما تایید شد",
  text: "درخواست شما برای تایید به مالک فضای کاری رسید.",
  note: null, // falls back to the sign-up wording below
  href: "/login",
  label: "رفتن به صفحه ورود",
};

export default function OtpVerify({
  email,
  length = 4,
  initialCooldown = 600,
  mailEnabled = false,
  onBack,
  verifyUrl = "/api/auth/verify-email",
  resendUrl = "/api/auth/resend-code",
  success: successCopy = DEFAULT_SUCCESS,
  backLabel = "ویرایش ایمیل",
}) {
  const emptyDigits = () => Array.from({ length }, () => "");
  const [digits, setDigits] = useState(emptyDigits);
  const [phase, setPhase] = useState("input");
  const [stageKey, setStageKey] = useState(0); // remounting the stage replays the intro animation after a wrong code
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [shake, setShake] = useState(false);
  const [expired, setExpired] = useState(false);
  const [endsAt, setEndsAt] = useState(() => Date.now() + initialCooldown * 1000);
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

  // countdown until a new code can be requested (computed from a timestamp, so it stays exact in background tabs)
  useEffect(() => {
    const tick = () => setCooldown(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  function startCooldown(seconds) {
    setEndsAt(Date.now() + seconds * 1000);
    setCooldown(seconds);
  }

  useEffect(() => {
    const timer = setTimeout(() => refs.current[0]?.focus(), 950); // after the boxes landed
    return () => clearTimeout(timer);
  }, []);

  // verify automatically as soon as the last digit is in
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
      const response = await fetch(verifyUrl, {
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
      if (data.codeExpired) startCooldown(0);
      setDigits(emptyDigits());
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
    for (const ch of text.slice(0, length - start)) next[i++] = ch;
    setDigits(next);
    refs.current[Math.min(i, length - 1)]?.focus();
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
    else if (event.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  }

  function onPaste(event) {
    event.preventDefault();
    const d = toDigits(event.clipboardData.getData("text")).slice(0, length);
    if (!d) return;
    const next = emptyDigits();
    [...d].forEach((ch, k) => (next[k] = ch));
    setError("");
    setDigits(next);
    refs.current[Math.min(d.length, length - 1)]?.focus();
  }

  async function resend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch(resendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "ارسال نشد.");
        if (data.retryAfterSec) startCooldown(data.retryAfterSec);
        if (data.expired) setExpired(true);
      } else {
        setInfo("کد جدید به ایمیل شما ارسال شد.");
        startCooldown(data.resendIn || 600);
        setDigits(emptyDigits());
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
  const stageClass = `otp-stage otp-len-${length}${verifying ? " is-orbit" : success ? " is-orbit is-merge is-success" : ""}${shake ? " otp-shake" : ""}${error ? " otp-error" : ""}`;

  return (
    <div className="otp-wrap" aria-live="polite">
      {resending && <PenLoader blocking delay={0.05} />}
      <h1>{success ? successCopy.title : verifying ? "در حال بررسی..." : "کد تایید را وارد کنید"}</h1>
      {success ? (
        <p>{successCopy.text}</p>
      ) : verifying ? (
        <p>کد شما به‌صورت امن بررسی می‌شود.</p>
      ) : (
        <p>
          کد {length.toLocaleString("fa-IR")} رقمی به <strong dir="ltr">{email}</strong> ارسال شد.
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
              style={{
                "--i": i,
                "--sx": SCATTER[i % 4].sx,
                "--sy": SCATTER[i % 4].sy,
                "--sr": SCATTER[i % 4].sr,
                ...positions(i, length),
              }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={d}
              readOnly={phase !== "input"}
              tabIndex={phase === "input" ? 0 : -1}
              aria-label={`رقم ${i + 1} از ${length.toLocaleString("fa-IR")}`}
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
              {resending ? "در حال ارسال..." : cooldown > 0 ? `ارسال مجدد (${clock(cooldown)})` : "ارسال مجدد"}
            </button>
          </div>
          <small className="otp-hint">
            {cooldown > 0
              ? "کد ۱۰ دقیقه معتبر است و بعد از پایان این زمان می‌توانید کد جدید بگیرید. پوشه‌ی Spam را هم نگاه کنید."
              : "مهلت کد تمام شد. روی «ارسال مجدد» بزنید تا کد جدید برایتان فرستاده شود."}
          </small>
          <button type="button" className="auth-link auth-link-button" onClick={onBack}>
            {expired ? "شروع دوباره" : backLabel}
          </button>
        </>
      )}

      {success && (
        <div className="otp-done">
          <div className="auth-success" role="status">
            {successCopy.note ||
              (mailEnabled
                ? "به‌محض اینکه مالک تایید کند، یک ایمیل اطلاع‌رسانی برایتان می‌آید (پوشه‌ی Spam را هم نگاه کنید). بعد از آن با ایمیل و رمز عبورتان وارد شوید."
                : "بعد از تایید مالک می‌توانید با ایمیل و رمز عبورتان وارد شوید.")}
          </div>
          <Link href={successCopy.href} className="secondary-button auth-register">{successCopy.label}</Link>
        </div>
      )}
    </div>
  );
}
