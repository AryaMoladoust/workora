"use client";

import { useState } from "react";
import Icon from "../ui/Icon";

export default function InviteCard({ initial }) {
  const [invite, setInvite] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  async function call(method, body) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/invite", {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "انجام نشد.");
      setInvite(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("کپی انجام نشد؛ متن را دستی انتخاب کنید.");
    }
  }

  const link = typeof window !== "undefined" && invite.code ? `${window.location.origin}/register?code=${invite.code}` : "";

  return (
    <section className="card invite-card">
      <div className="invite-head">
        <span className="card-title-icon"><Icon name="users" size={17} /></span>
        <div>
          <h3>ثبت‌نام اعضا با کد دعوت</h3>
          <p>کد را به همکاران بدهید؛ در صفحه ورود روی «ثبت‌نام» می‌زنند و با همین کد حساب عضو می‌سازند (بدون دسترسی مدیریتی).</p>
        </div>
      </div>

      {invite.code ? (
        <div className="invite-body">
          <div className={`invite-code ${invite.enabled ? "" : "is-off"}`} dir="ltr">{invite.code}</div>
          <div className="invite-actions">
            <button type="button" className="secondary-button" onClick={() => copy(invite.code, "code")}>{copied === "code" ? "کپی شد ✓" : "کپی کد"}</button>
            <button type="button" className="secondary-button" onClick={() => copy(link, "link")}>{copied === "link" ? "کپی شد ✓" : "کپی لینک ثبت‌نام"}</button>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => call("PATCH", { enabled: !invite.enabled })}>
              {invite.enabled ? "غیرفعال کردن ثبت‌نام" : "فعال کردن ثبت‌نام"}
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() => window.confirm("کد جدید ساخته می‌شود و کد قبلی دیگر کار نمی‌کند. ادامه می‌دهید؟") && call("POST")}
            >
              ساخت کد جدید
            </button>
          </div>
          <p className="invite-status">
            وضعیت: {invite.enabled ? <strong className="text-ok">فعال — هر کسی با این کد می‌تواند عضو شود</strong> : <strong className="text-danger">غیرفعال — ثبت‌نام با کد بسته است</strong>}
          </p>
        </div>
      ) : (
        <div className="invite-body">
          <p className="field-hint">هنوز کدی ساخته نشده است؛ تا آن موقع فقط خودتان می‌توانید عضو اضافه کنید.</p>
          <button type="button" className="primary-button" disabled={busy} onClick={() => call("POST")}>ساخت کد دعوت و فعال‌سازی</button>
        </div>
      )}
      {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
    </section>
  );
}
