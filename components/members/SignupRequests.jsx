"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import { useConfirm } from "../ui/Feedback";
import { dateTime } from "../../lib/format";

export default function SignupRequests({ initialEnabled, requests, domainHint }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function review(id, action) {
    if (action === "reject" && !(await confirm({ title: "رد درخواست", message: "این درخواست رد و حذف می‌شود. ادامه می‌دهید؟", confirmLabel: "رد درخواست", danger: true }))) return;
    setBusyId(id);
    setError("");
    setNotice("");
    const person = requests.find((r) => r.membershipId === id);
    try {
      const response = await fetch(`/api/members/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "انجام نشد.");
      if (action === "approve") {
        const who = person ? person.email : "کاربر";
        setNotice(
          data.email === "sent"
            ? `تایید شد و ایمیل اطلاع‌رسانی برای ${who} ارسال شد.`
            : data.email === "failed"
            ? `تایید شد، اما ارسال ایمیل به ${who} ناموفق بود؛ خودتان به او خبر بدهید.`
            : `تایید شد. ارسال ایمیل تنظیم نشده است؛ خودتان به ${who} خبر بدهید.`
        );
      } else {
        setNotice("درخواست رد شد.");
      }
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  async function toggle() {
    setBusyId("toggle");
    setError("");
    try {
      const response = await fetch("/api/workspace/signup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "انجام نشد.");
      setEnabled(data.enabled);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="card invite-card request-card">
      <div className="invite-head">
        <span className="card-title-icon"><Icon name="users" size={17} /></span>
        <div>
          <h3>درخواست‌های ثبت‌نام{requests.length ? ` (${requests.length.toLocaleString("fa-IR")})` : ""}</h3>
          <p>
            هر کس با ایمیل {domainHint || "خودش"} درخواست بدهد اینجا می‌آید و تا وقتی تایید نکنید نمی‌تواند وارد شود.
          </p>
        </div>
        <button type="button" className="secondary-button request-toggle" disabled={busyId === "toggle"} onClick={toggle}>
          {enabled ? "بستن درخواست‌ها" : "باز کردن درخواست‌ها"}
        </button>
      </div>

      {!enabled && <p className="invite-status"><strong className="text-danger">ثبت‌نام با درخواست بسته است.</strong> فقط با کد دعوت یا افزودن دستی عضو می‌توان وارد شد.</p>}

      {requests.length === 0 ? (
        <p className="field-hint">درخواست در انتظاری وجود ندارد.</p>
      ) : (
        <ul className="request-list">
          {requests.map((r) => (
            <li key={r.membershipId} className="request-row">
              <div className="request-info">
                <strong>{r.firstName} {r.lastName}</strong>
                <span dir="ltr">{r.email}</span>
                <small>{dateTime(r.requestedAt)}</small>
              </div>
              <div className="request-actions">
                <button type="button" className="primary-button" disabled={busyId === r.membershipId} onClick={() => review(r.membershipId, "approve")}>تایید و اجازه ورود</button>
                <button type="button" className="danger-button" disabled={busyId === r.membershipId} onClick={() => review(r.membershipId, "reject")}>رد</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {notice && <div className="auth-success" role="status" style={{ marginTop: 12 }}>{notice}</div>}
      {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
    </section>
  );
}
