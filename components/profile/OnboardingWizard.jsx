"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "../ui/Modal";
import Icon from "../ui/Icon";
import { useToast } from "../ui/Feedback";
import AvatarUploader from "./AvatarUploader";
import { JALALI_MONTHS } from "../../lib/jalali";
import { fa } from "../../lib/format";

const STEPS = ["معرفی", "تخصص", "سوابق"];

// First-login wizard: every step is optional and can be skipped; nothing is required to use the app.
export default function OnboardingWizard({ user }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({ headline: "", location: "", about: "", skills: [], draft: "", job: { title: "", company: "", fromYear: "", current: true }, edu: { school: "", degree: "", field: "", toYear: "" } });

  async function put(body) {
    const r = await fetch("/api/profile/details", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "ذخیره انجام نشد.");
  }

  async function skipAll() {
    setBusy(true);
    try {
      await put({ finishOnboarding: true });
    } catch {
      /* the wizard may simply show again next time */
    }
    setOpen(false);
    router.refresh();
  }

  function addSkill() {
    const parts = f.draft.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) setF((x) => ({ ...x, skills: [...new Set([...x.skills, ...parts])].slice(0, 30), draft: "" }));
  }

  async function next() {
    setError("");
    setBusy(true);
    try {
      if (step === 0) {
        await put({ headline: f.headline, location: f.location });
        setStep(1);
      } else if (step === 1) {
        const skills = [...new Set([...f.skills, ...f.draft.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean)])];
        await put({ about: f.about, skills });
        setF((x) => ({ ...x, skills, draft: "" }));
        setStep(2);
      } else {
        const body = { finishOnboarding: true };
        if (f.job.title.trim()) body.experiences = [{ title: f.job.title, company: f.job.company, fromYear: f.job.fromYear || null, current: f.job.current, toYear: null }];
        if (f.edu.school.trim()) body.education = [{ school: f.edu.school, degree: f.edu.degree, field: f.edu.field, toYear: f.edu.toYear || null }];
        await put(body);
        toast.success("پروفایل شما ذخیره شد. هر وقت خواستید می‌توانید کاملش کنید.");
        setOpen(false);
        router.refresh();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const last = step === STEPS.length - 1;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      open
      onClose={skipAll}
      title={`خوش آمدید، ${user.firstName} 👋`}
      size="lg"
      footer={
        <>
          <button type="button" className="secondary-button footer-start" onClick={skipAll} disabled={busy}>بعداً تکمیل می‌کنم</button>
          {step > 0 && <button type="button" className="secondary-button" onClick={() => setStep(step - 1)} disabled={busy}>قبلی</button>}
          <button type="button" className="primary-button" onClick={next} disabled={busy}>{busy ? "در حال ذخیره..." : last ? "پایان" : "ذخیره و ادامه"}</button>
        </>
      }
    >
      <div className="ob">
        <ol className="ob-steps" aria-label="مراحل">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? "is-active" : i < step ? "is-done" : ""}>
              <span>{i < step ? <Icon name="check" size={13} strokeWidth={3} /> : fa(i + 1)}</span>{s}
            </li>
          ))}
        </ol>
        <p className="ob-lead">
          {step === 0 && "برای اینکه همکارانتان شما را بهتر بشناسند، پروفایل‌تان را تکمیل کنید. همه‌ی بخش‌ها اختیاری است."}
          {step === 1 && "بگویید در چه کاری تخصص دارید تا همکاران بدانند برای چه چیزی سراغ شما بیایند."}
          {step === 2 && "کارها و تحصیلات قبلی‌تان را بنویسید (می‌توانید بعداً مورد بیشتری اضافه کنید)."}
        </p>

        {step === 0 && (
          <div className="ob-body">
            <div className="ob-photo">
              <AvatarUploader user={user} size="xl" compact />
            </div>
            <div className="form-grid">
              <label className="field-wide">عنوان شغلی<input value={f.headline} maxLength={120} placeholder="مثلاً توسعه‌دهنده‌ی فرانت‌اند" onChange={(e) => set("headline", e.target.value)} autoFocus /></label>
              <label className="field-wide">محل سکونت<input value={f.location} maxLength={80} placeholder="مثلاً تهران، ایران" onChange={(e) => set("location", e.target.value)} /></label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="form-grid">
            <label className="field-wide">درباره‌ی من<textarea rows={5} maxLength={2000} value={f.about} placeholder="کوتاه از خودتان و کارتان بنویسید..." onChange={(e) => set("about", e.target.value)} autoFocus /></label>
            <div className="field-wide">
              <label>مهارت‌ها و تخصص‌ها
                <div className="pf-skill-input">
                  <input value={f.draft} maxLength={40} placeholder="مثلاً React، طراحی UI، مدیریت پروژه" onChange={(e) => set("draft", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
                  <button type="button" className="secondary-button" onClick={addSkill}>افزودن</button>
                </div>
              </label>
              <div className="pf-chips" style={{ marginTop: 10 }}>
                {f.skills.map((s) => <span className="pf-chip is-editable" key={s}>{s}<button type="button" aria-label={`حذف ${s}`} onClick={() => set("skills", f.skills.filter((x) => x !== s))}><Icon name="close" size={12} /></button></span>)}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <h4 className="field-wide ob-sub"><Icon name="briefcase" size={16} />آخرین سابقه‌ی کاری</h4>
            <label>عنوان شغلی<input value={f.job.title} maxLength={100} onChange={(e) => set("job", { ...f.job, title: e.target.value })} /></label>
            <label>شرکت / سازمان<input value={f.job.company} maxLength={100} onChange={(e) => set("job", { ...f.job, company: e.target.value })} /></label>
            <label>سال شروع (شمسی)<input type="number" inputMode="numeric" min="1300" max="1500" placeholder="مثلاً ۱۴۰۱" value={f.job.fromYear} onChange={(e) => set("job", { ...f.job, fromYear: e.target.value })} /></label>
            <label className="switch-row"><input type="checkbox" checked={f.job.current} onChange={(e) => set("job", { ...f.job, current: e.target.checked })} /><span><strong>هنوز مشغول هستم</strong></span></label>
            <h4 className="field-wide ob-sub"><Icon name="graduation" size={16} />تحصیلات</h4>
            <label>دانشگاه / مؤسسه<input value={f.edu.school} maxLength={120} onChange={(e) => set("edu", { ...f.edu, school: e.target.value })} /></label>
            <label>مقطع<input value={f.edu.degree} maxLength={80} placeholder="مثلاً کارشناسی" onChange={(e) => set("edu", { ...f.edu, degree: e.target.value })} /></label>
            <label>رشته<input value={f.edu.field} maxLength={100} onChange={(e) => set("edu", { ...f.edu, field: e.target.value })} /></label>
            <label>سال پایان<input type="number" inputMode="numeric" min="1300" max="1500" value={f.edu.toYear} onChange={(e) => set("edu", { ...f.edu, toYear: e.target.value })} /></label>
          </div>
        )}
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    </Modal>
  );
}
