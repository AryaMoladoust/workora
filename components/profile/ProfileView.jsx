"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Avatar from "../ui/Avatar";
import { useConfirm, useToast } from "../ui/Feedback";
import AvatarUploader from "./AvatarUploader";
import CompletenessRing from "./CompletenessRing";
import { JALALI_MONTHS } from "../../lib/jalali";
import { EMPLOYMENT_TYPES, LANGUAGE_LEVELS, LINK_KEYS, linkHref } from "../../lib/profile-shared";
import { fa, hueFromString } from "../../lib/format";

const LINK_LABELS = { website: "وب‌سایت", linkedin: "لینکدین", github: "گیت‌هاب", telegram: "تلگرام", instagram: "اینستاگرام" };
const LINK_HINTS = { website: "example.com", linkedin: "linkedin.com/in/نام-شما", github: "github.com/نام-کاربری", telegram: "@username", instagram: "@username" };

const faYear = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

function period(e) {
  const from = e.fromYear ? `${e.fromMonth ? `${JALALI_MONTHS[e.fromMonth - 1]} ` : ""}${faYear(e.fromYear)}` : "";
  const to = e.current ? "اکنون" : e.toYear ? `${e.toMonth ? `${JALALI_MONTHS[e.toMonth - 1]} ` : ""}${faYear(e.toYear)}` : "";
  return [from, to].filter(Boolean).join(" — ");
}

function SectionCard({ id, icon, title, onEdit, onAdd, empty, children, isEmpty }) {
  return (
    <section className="card pf-card" id={id}>
      <header className="card-head">
        <h3 className="card-title"><span className="card-title-icon"><Icon name={icon} size={17} /></span>{title}</h3>
        <span className="pf-card-actions">
          {onAdd && <button type="button" className="icon-button pf-icon-btn" aria-label={`افزودن ${title}`} title="افزودن" onClick={onAdd}><Icon name="plus" size={17} /></button>}
          {onEdit && <button type="button" className="icon-button pf-icon-btn" aria-label={`ویرایش ${title}`} title="ویرایش" onClick={onEdit}><Icon name="pencil" size={16} /></button>}
        </span>
      </header>
      {isEmpty ? <p className="pf-empty">{empty}</p> : children}
    </section>
  );
}

/* ------------------------------------------------------------------ editors (modals) */
function Field({ label, children, wide }) {
  return <label className={wide ? "field-wide" : undefined}>{label}{children}</label>;
}

function YearMonth({ label, year, month, onYear, onMonth, disabled }) {
  return (
    <div className="pf-ym">
      <span>{label}</span>
      <div>
        <select value={month || ""} onChange={(e) => onMonth(e.target.value ? Number(e.target.value) : null)} disabled={disabled}>
          <option value="">ماه</option>
          {JALALI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" inputMode="numeric" placeholder="سال (مثلاً ۱۴۰۲)" min="1300" max="1500" value={year || ""} onChange={(e) => onYear(e.target.value ? Number(e.target.value) : null)} disabled={disabled} />
      </div>
    </div>
  );
}

function EditorModal({ title, onClose, onSubmit, busy, error, children, extraFooter, size = "md" }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <>
          {extraFooter}
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>انصراف</button>
          <button type="submit" form="pf-form" className="primary-button" disabled={busy}>{busy ? "در حال ذخیره..." : "ذخیره"}</button>
        </>
      }
    >
      <form id="pf-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        {children}
        {error && <div className="form-error field-wide">{error}</div>}
      </form>
    </Modal>
  );
}

function AboutEditor({ profile, save, onClose }) {
  const [f, setF] = useState({ headline: profile.headline, location: profile.location, about: profile.about });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <EditorModal title="ویرایش اطلاعات اصلی" onClose={onClose} busy={busy} error={error} onSubmit={() => save(f, setBusy, setError, onClose)}>
      <Field label="عنوان شغلی (زیر نام شما نمایش داده می‌شود)" wide>
        <input value={f.headline} maxLength={120} placeholder="مثلاً توسعه‌دهنده‌ی فرانت‌اند | طراح محصول" onChange={(e) => setF({ ...f, headline: e.target.value })} autoFocus />
      </Field>
      <Field label="محل سکونت" wide>
        <input value={f.location} maxLength={80} placeholder="مثلاً تهران، ایران" onChange={(e) => setF({ ...f, location: e.target.value })} />
      </Field>
      <Field label={`درباره‌ی من (${fa(f.about.length)}/۲۰۰۰)`} wide>
        <textarea rows={7} maxLength={2000} value={f.about} placeholder="کوتاه بنویسید که چه کاری می‌کنید، در چه چیزی تخصص دارید و به چه چیزی علاقه دارید." onChange={(e) => setF({ ...f, about: e.target.value })} />
      </Field>
    </EditorModal>
  );
}

function SkillsEditor({ profile, save, onClose }) {
  const [skills, setSkills] = useState(profile.skills);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function add() {
    const parts = draft.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setSkills((list) => [...new Set([...list, ...parts])].slice(0, 30));
    setDraft("");
  }
  return (
    <EditorModal title="مهارت‌ها و تخصص‌ها" onClose={onClose} busy={busy} error={error} onSubmit={() => save({ skills: draft.trim() ? [...new Set([...skills, ...draft.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean)])] : skills }, setBusy, setError, onClose)}>
      <Field label="مهارت جدید (با Enter یا ویرگول اضافه کنید)" wide>
        <div className="pf-skill-input">
          <input value={draft} maxLength={40} placeholder="مثلاً React، طراحی UI، مدیریت پروژه" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} autoFocus />
          <button type="button" className="secondary-button" onClick={add}>افزودن</button>
        </div>
      </Field>
      <div className="field-wide">
        <div className="pf-chips">
          {skills.map((s) => (
            <span className="pf-chip is-editable" key={s}>{s}<button type="button" aria-label={`حذف ${s}`} onClick={() => setSkills((l) => l.filter((x) => x !== s))}><Icon name="close" size={12} /></button></span>
          ))}
          {skills.length === 0 && <span className="pf-empty">هنوز مهارتی اضافه نشده است.</span>}
        </div>
        <small className="field-hint">حداکثر ۳۰ مهارت.</small>
      </div>
    </EditorModal>
  );
}

function ExperienceEditor({ item, profile, save, onClose }) {
  const confirm = useConfirm();
  const [f, setF] = useState(item || { title: "", company: "", employmentType: "", location: "", fromYear: null, fromMonth: null, toYear: null, toMonth: null, current: false, description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const others = profile.experiences.filter((e) => e.id !== item?.id);
  const submit = () => {
    const list = item ? profile.experiences.map((e) => (e.id === item.id ? { ...f, _id: item.id } : { ...e, _id: e.id })) : [...others.map((e) => ({ ...e, _id: e.id })), f];
    save({ experiences: list }, setBusy, setError, onClose);
  };
  async function remove() {
    if (!(await confirm({ title: "حذف سابقه‌ی کاری", message: "این سابقه‌ی کاری حذف شود؟", confirmLabel: "حذف", danger: true }))) return;
    save({ experiences: others.map((e) => ({ ...e, _id: e.id })) }, setBusy, setError, onClose);
  }
  return (
    <EditorModal title={item ? "ویرایش سابقه‌ی کاری" : "افزودن سابقه‌ی کاری"} onClose={onClose} busy={busy} error={error} onSubmit={submit}
      extraFooter={item ? <button type="button" className="danger-button footer-start" onClick={remove} disabled={busy}>حذف</button> : null}>
      <Field label="عنوان شغلی *" wide><input value={f.title} maxLength={100} required placeholder="مثلاً توسعه‌دهنده‌ی ارشد" onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
      <Field label="شرکت / سازمان"><input value={f.company} maxLength={100} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
      <Field label="نوع همکاری">
        <select value={f.employmentType} onChange={(e) => setF({ ...f, employmentType: e.target.value })}>
          <option value="">—</option>
          {Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="محل" wide><input value={f.location} maxLength={80} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
      <YearMonth label="شروع" year={f.fromYear} month={f.fromMonth} onYear={(v) => setF({ ...f, fromYear: v })} onMonth={(v) => setF({ ...f, fromMonth: v })} />
      <YearMonth label="پایان" year={f.toYear} month={f.toMonth} onYear={(v) => setF({ ...f, toYear: v })} onMonth={(v) => setF({ ...f, toMonth: v })} disabled={f.current} />
      <label className="switch-row field-wide">
        <input type="checkbox" checked={f.current} onChange={(e) => setF({ ...f, current: e.target.checked })} />
        <span><strong>هنوز در این سمت مشغول هستم</strong></span>
      </label>
      <Field label="توضیحات (کارهایی که انجام دادید، دستاوردها)" wide><textarea rows={4} maxLength={1000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
    </EditorModal>
  );
}

function EducationEditor({ item, profile, save, onClose }) {
  const confirm = useConfirm();
  const [f, setF] = useState(item || { school: "", degree: "", field: "", fromYear: null, toYear: null, description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const others = profile.education.filter((e) => e.id !== item?.id);
  const submit = () => {
    const list = item ? profile.education.map((e) => (e.id === item.id ? { ...f, _id: item.id } : { ...e, _id: e.id })) : [...others.map((e) => ({ ...e, _id: e.id })), f];
    save({ education: list }, setBusy, setError, onClose);
  };
  async function remove() {
    if (!(await confirm({ title: "حذف سابقه‌ی تحصیلی", message: "این مورد حذف شود؟", confirmLabel: "حذف", danger: true }))) return;
    save({ education: others.map((e) => ({ ...e, _id: e.id })) }, setBusy, setError, onClose);
  }
  const yearInput = (key, label) => (
    <Field label={label}><input type="number" inputMode="numeric" min="1300" max="1500" placeholder="مثلاً ۱۳۹۸" value={f[key] || ""} onChange={(e) => setF({ ...f, [key]: e.target.value ? Number(e.target.value) : null })} /></Field>
  );
  return (
    <EditorModal title={item ? "ویرایش سابقه‌ی تحصیلی" : "افزودن سابقه‌ی تحصیلی"} onClose={onClose} busy={busy} error={error} onSubmit={submit}
      extraFooter={item ? <button type="button" className="danger-button footer-start" onClick={remove} disabled={busy}>حذف</button> : null}>
      <Field label="دانشگاه / مؤسسه *" wide><input value={f.school} maxLength={120} required onChange={(e) => setF({ ...f, school: e.target.value })} autoFocus /></Field>
      <Field label="مقطع / مدرک"><input value={f.degree} maxLength={80} placeholder="مثلاً کارشناسی" onChange={(e) => setF({ ...f, degree: e.target.value })} /></Field>
      <Field label="رشته"><input value={f.field} maxLength={100} onChange={(e) => setF({ ...f, field: e.target.value })} /></Field>
      {yearInput("fromYear", "سال شروع")}
      {yearInput("toYear", "سال پایان (یا پیش‌بینی)")}
      <Field label="توضیحات" wide><textarea rows={3} maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
    </EditorModal>
  );
}

function LinksEditor({ profile, save, onClose }) {
  const [links, setLinks] = useState(profile.links);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <EditorModal title="لینک‌ها و شبکه‌های اجتماعی" onClose={onClose} busy={busy} error={error} onSubmit={() => save({ links }, setBusy, setError, onClose)}>
      {LINK_KEYS.map((k, i) => (
        <Field key={k} label={LINK_LABELS[k]} wide>
          <input dir="ltr" value={links[k] || ""} placeholder={LINK_HINTS[k]} onChange={(e) => setLinks({ ...links, [k]: e.target.value })} autoFocus={i === 0} />
        </Field>
      ))}
    </EditorModal>
  );
}

function LanguagesEditor({ profile, save, onClose }) {
  const [rows, setRows] = useState(profile.languages.length ? profile.languages : [{ name: "", level: "professional" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (i, patch) => setRows((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <EditorModal title="زبان‌ها" onClose={onClose} busy={busy} error={error} onSubmit={() => save({ languages: rows.filter((r) => r.name.trim()) }, setBusy, setError, onClose)}>
      {rows.map((r, i) => (
        <div className="pf-lang-row field-wide" key={i}>
          <input value={r.name} maxLength={40} placeholder="مثلاً انگلیسی" onChange={(e) => set(i, { name: e.target.value })} autoFocus={i === 0} />
          <select value={r.level} onChange={(e) => set(i, { level: e.target.value })}>
            {Object.entries(LANGUAGE_LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" className="icon-button" aria-label="حذف" onClick={() => setRows((l) => l.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>
        </div>
      ))}
      <div className="field-wide"><button type="button" className="secondary-button" onClick={() => setRows((l) => [...l, { name: "", level: "professional" }])} disabled={rows.length >= 10}><Icon name="plus" size={16} />زبان دیگر</button></div>
    </EditorModal>
  );
}

/* ------------------------------------------------------------------ page */
export default function ProfileView({ data }) {
  const router = useRouter();
  const toast = useToast();
  const { isSelf, user, role, stats } = data;
  const [profile, setProfile] = useState(data.profile);
  const [completeness, setCompleteness] = useState(data.completeness);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [editor, setEditor] = useState(null); // { kind, item }
  const [messaging, setMessaging] = useState(false);

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const hue = hueFromString(user.id);
  const close = () => setEditor(null);

  async function save(patch, setBusy, setError, done) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/profile/details", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "ذخیره انجام نشد.");
      setProfile(d.profile);
      setCompleteness((c) => ({ ...c, percent: d.completeness }));
      toast.success("تغییرات ذخیره شد");
      done();
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function startChat() {
    setMessaging(true);
    try {
      const r = await fetch("/api/chat/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "باز کردن گفتگو انجام نشد.");
      router.push(`/chat?c=${d.conversation.id}`);
    } catch (e) {
      toast.error(e.message);
      setMessaging(false);
    }
  }

  const hasLinks = LINK_KEYS.some((k) => profile.links[k]);
  const openExp = (item) => setEditor({ kind: "exp", item });
  const openEdu = (item) => setEditor({ kind: "edu", item });
  const joined = data.joinedAt ? new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long" }).format(new Date(data.joinedAt)) : "";

  return (
    <div className="pf-page">
      <section className="card pf-hero">
        <div className="pf-cover" style={{ "--h": hue }}>
          <span className="pf-cover-orb pf-cover-orb-1" />
          <span className="pf-cover-orb pf-cover-orb-2" />
        </div>
        <div className="pf-hero-body">
          <div className="pf-hero-photo" id="photo">
            {isSelf ? <AvatarUploader user={{ ...user, avatarUrl }} size="xl" onChange={setAvatarUrl} /> : <Avatar user={user} size="xl" />}
          </div>
          <div className="pf-hero-main">
            <div className="pf-hero-titles">
              <h1>{fullName}</h1>
              {profile.headline ? <p className="pf-headline">{profile.headline}</p> : isSelf ? <p className="pf-headline is-placeholder">عنوان شغلی خود را اضافه کنید</p> : null}
              <p className="pf-meta">
                {profile.location && <span><Icon name="mapPin" size={14} />{profile.location}</span>}
                <span className="chip chip-member">{role === "owner" ? "مالک فضای کاری" : "عضو فضای کاری"}</span>
                {joined && <span>عضو از {joined}</span>}
              </p>
            </div>
            <div className="pf-hero-actions">
              {isSelf ? (
                <button type="button" className="primary-button" onClick={() => setEditor({ kind: "about" })}><Icon name="pencil" size={16} />ویرایش پروفایل</button>
              ) : (
                <button type="button" className="primary-button" onClick={startChat} disabled={messaging}><Icon name="chat" size={16} />{messaging ? "در حال باز کردن..." : "ارسال پیام"}</button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="pf-grid">
        <div className="pf-main">
          <SectionCard id="about" icon="user" title="درباره" onEdit={isSelf ? () => setEditor({ kind: "about" }) : null} isEmpty={!profile.about} empty={isSelf ? "یک معرفی کوتاه از خودتان بنویسید: چه کاری می‌کنید و در چه زمینه‌ای تخصص دارید." : "هنوز معرفی‌ای نوشته نشده است."}>
            <p className="pf-about">{profile.about}</p>
          </SectionCard>

          <SectionCard id="skills" icon="star" title="مهارت‌ها و تخصص‌ها" onEdit={isSelf ? () => setEditor({ kind: "skills" }) : null} isEmpty={profile.skills.length === 0} empty={isSelf ? "مهارت‌هایتان را اضافه کنید تا همکاران بدانند در چه کاری می‌توانند از شما کمک بگیرند." : "مهارتی ثبت نشده است."}>
            <div className="pf-chips">{profile.skills.map((s) => <span className="pf-chip" key={s}>{s}</span>)}</div>
          </SectionCard>

          <SectionCard id="experience" icon="briefcase" title="سوابق کاری" onAdd={isSelf ? () => openExp(null) : null} isEmpty={profile.experiences.length === 0} empty={isSelf ? "کارهایی که قبلاً انجام داده‌اید یا الان انجام می‌دهید را اضافه کنید." : "سابقه‌ای ثبت نشده است."}>
            <ol className="pf-timeline">
              {profile.experiences.map((e) => (
                <li key={e.id}>
                  <span className="pf-tl-icon"><Icon name="briefcase" size={16} /></span>
                  <div className="pf-tl-body">
                    <div className="pf-tl-head">
                      <strong>{e.title}</strong>
                      {isSelf && <button type="button" className="icon-button pf-icon-btn" aria-label="ویرایش" onClick={() => openExp(e)}><Icon name="pencil" size={15} /></button>}
                    </div>
                    <span className="pf-tl-sub">{[e.company, EMPLOYMENT_TYPES[e.employmentType]].filter(Boolean).join(" · ")}</span>
                    <span className="pf-tl-date">{[period(e), e.location].filter(Boolean).join(" · ")}</span>
                    {e.description && <p>{e.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard id="education" icon="graduation" title="تحصیلات" onAdd={isSelf ? () => openEdu(null) : null} isEmpty={profile.education.length === 0} empty={isSelf ? "دانشگاه یا دوره‌های آموزشی‌تان را اضافه کنید." : "سابقه‌ای ثبت نشده است."}>
            <ol className="pf-timeline">
              {profile.education.map((e) => (
                <li key={e.id}>
                  <span className="pf-tl-icon"><Icon name="graduation" size={16} /></span>
                  <div className="pf-tl-body">
                    <div className="pf-tl-head">
                      <strong>{e.school}</strong>
                      {isSelf && <button type="button" className="icon-button pf-icon-btn" aria-label="ویرایش" onClick={() => openEdu(e)}><Icon name="pencil" size={15} /></button>}
                    </div>
                    <span className="pf-tl-sub">{[e.degree, e.field].filter(Boolean).join("، ")}</span>
                    <span className="pf-tl-date">{[e.fromYear && faYear(e.fromYear), e.toYear && faYear(e.toYear)].filter(Boolean).join(" — ")}</span>
                    {e.description && <p>{e.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>

        <aside className="pf-side">
          {isSelf && completeness.percent < 100 && (
            <section className="card pf-card pf-complete">
              <CompletenessRing percent={completeness.percent} />
              <div>
                <h3>پروفایل شما {fa(completeness.percent)}٪ کامل است</h3>
                <ul>
                  {completeness.steps.filter((s) => !s.done).slice(0, 4).map((s) => <li key={s.id}><Link href={s.href}>+ {s.label}</Link></li>)}
                </ul>
              </div>
            </section>
          )}

          <section className="card pf-card">
            <header className="card-head"><h3 className="card-title"><span className="card-title-icon"><Icon name="trend" size={17} /></span>در Workora</h3></header>
            <div className="pf-stats">
              <div><strong>{fa(stats.projects)}</strong><span>پروژه</span></div>
              <div><strong>{fa(stats.doneTasks)}</strong><span>وظیفه‌ی انجام‌شده</span></div>
              <div><strong>{fa(stats.openTasks)}</strong><span>وظیفه‌ی باز</span></div>
            </div>
            {stats.sharedProjects.length > 0 && (
              <div className="pf-projects">
                <small>{isSelf ? "پروژه‌های من" : "پروژه‌های مشترک"}</small>
                {stats.sharedProjects.map((p) => <Link key={p.id} href={`/projects/${p.id}`} className="pf-project-link">{p.name}</Link>)}
              </div>
            )}
          </section>

          {(isSelf || hasLinks) && (
            <SectionCard id="links" icon="link" title="لینک‌ها" onEdit={isSelf ? () => setEditor({ kind: "links" }) : null} isEmpty={!hasLinks} empty="لینک لینکدین، گیت‌هاب یا وب‌سایت‌تان را اضافه کنید.">
              <ul className="pf-links">
                {LINK_KEYS.filter((k) => profile.links[k]).map((k) => (
                  <li key={k}><a href={linkHref(k, profile.links[k])} target="_blank" rel="noopener noreferrer nofollow"><span>{LINK_LABELS[k]}</span><Icon name="arrowLeft" size={14} /></a></li>
                ))}
              </ul>
            </SectionCard>
          )}

          {(isSelf || profile.languages.length > 0) && (
            <SectionCard id="languages" icon="languages" title="زبان‌ها" onEdit={isSelf ? () => setEditor({ kind: "languages" }) : null} isEmpty={profile.languages.length === 0} empty="زبان‌هایی که بلد هستید را اضافه کنید.">
              <ul className="pf-langs">
                {profile.languages.map((l) => <li key={l.name}><strong>{l.name}</strong><span>{LANGUAGE_LEVELS[l.level]}</span></li>)}
              </ul>
            </SectionCard>
          )}

          {isSelf && (
            <section className="card pf-card">
              <header className="card-head"><h3 className="card-title"><span className="card-title-icon"><Icon name="mail" size={17} /></span>اطلاعات تماس</h3></header>
              <ul className="pf-contact">
                <li><Icon name="mail" size={15} /><span dir="ltr">{user.email}</span></li>
                {user.phone && <li><Icon name="phone" size={15} /><span dir="ltr">{user.phone}</span></li>}
              </ul>
              <small className="field-hint">ایمیل و تلفن فقط برای خودتان نمایش داده می‌شود. برای تغییر نام و تلفن به <Link href="/settings">تنظیمات</Link> بروید.</small>
            </section>
          )}
        </aside>
      </div>

      {editor?.kind === "about" && <AboutEditor profile={profile} save={save} onClose={close} />}
      {editor?.kind === "skills" && <SkillsEditor profile={profile} save={save} onClose={close} />}
      {editor?.kind === "exp" && <ExperienceEditor item={editor.item} profile={profile} save={save} onClose={close} />}
      {editor?.kind === "edu" && <EducationEditor item={editor.item} profile={profile} save={save} onClose={close} />}
      {editor?.kind === "links" && <LinksEditor profile={profile} save={save} onClose={close} />}
      {editor?.kind === "languages" && <LanguagesEditor profile={profile} save={save} onClose={close} />}
    </div>
  );
}
