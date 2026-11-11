"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import MemberPicker from "../ui/MemberPicker";
import { useToast } from "../ui/Feedback";
import { PRESET_KEYS, VAULT_PRESETS } from "../../lib/vault-presets";

const PRESET_ICON = Object.fromEntries(VAULT_PRESETS.map((p) => [p.key, p.icon]));

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

function generatePassword(length = 18) {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_=+";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function scopeLabel(item) {
  if (item.scope === "workspace") return "همه اعضا";
  if (item.scope === "users") return `${item.sharedCount.toLocaleString("fa-IR")} نفر`;
  return "فقط من";
}

export default function VaultManager({ locked, initialItems, members, meId }) {
  return locked ? <VaultGate /> : <VaultList initialItems={initialItems} members={members} meId={meId} />;
}

/* ------------------------------------------------------------------ the lock screen */
function VaultGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/vault/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "باز کردن انجام نشد.");
      setPassword("");
      router.refresh();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="form-card vault-gate">
      <span className="vault-gate-icon"><Icon name="lock" size={30} /></span>
      <h2>بخش رمزها قفل است</h2>
      <p>برای ورود به این بخش، رمز ورک‌اورای خودتان (همان رمزی که با آن وارد برنامه می‌شوید) را وارد کنید. بعد از ۳۰ دقیقه دوباره قفل می‌شود.</p>
      <form onSubmit={submit}>
        <label>
          رمز ورک‌اورا
          <span className="vault-field">
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus placeholder="رمز ورود به حساب" />
            <button type="button" className="icon-button" onClick={() => setShow((v) => !v)} title={show ? "پنهان کردن" : "نمایش"} aria-label={show ? "پنهان کردن" : "نمایش"}>
              <Icon name={show ? "eyeOff" : "eye"} size={18} />
            </button>
          </span>
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="primary-button" disabled={busy || !password}>{busy ? "در حال بررسی..." : "باز کردن بخش رمزها"}</button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ the list */
function VaultList({ initialItems, members, meId }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initialItems);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState(null); // { mode, secret }
  const [busyId, setBusyId] = useState("");
  const [restoring, setRestoring] = useState(false);

  const missingPresets = useMemo(() => {
    const have = new Set(items.filter((i) => i.ownerId === meId).map((i) => i.preset));
    return PRESET_KEYS.filter((k) => !have.has(k));
  }, [items, meId]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "mine" && i.ownerId !== meId) return false;
      if (filter === "withMe" && i.ownerId === meId) return false;
      if (!needle) return true;
      return i.title.toLowerCase().includes(needle) || i.username.toLowerCase().includes(needle);
    });
  }, [items, q, filter, meId]);

  function relock() {
    toast("بخش رمزها قفل شد.", { kind: "error", duration: 2600 });
    router.refresh();
  }

  // Loads one entry with its password (the list never contains passwords).
  async function reveal(id) {
    const r = await fetch(`/api/vault/${id}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.status === 423) {
      relock();
      return null;
    }
    if (!r.ok) throw new Error(d.error || "باز کردن انجام نشد.");
    return d.secret;
  }

  async function openItem(item) {
    setBusyId(item.id);
    try {
      const secret = await reveal(item.id);
      if (secret) setEditor({ mode: "edit", secret });
    } catch (e) {
      toast(e.message, { kind: "error", duration: 3200 });
    } finally {
      setBusyId("");
    }
  }

  async function copyFromCard(event, item) {
    event.stopPropagation();
    try {
      const secret = await reveal(item.id);
      if (!secret) return;
      if (!secret.password) {
        toast("این رمز هنوز پر نشده است.", { kind: "error", duration: 2600 });
        return;
      }
      toast((await copyText(secret.password)) ? "رمز کپی شد" : "کپی انجام نشد", { kind: "success", duration: 2200 });
    } catch (e) {
      toast(e.message, { kind: "error", duration: 3200 });
    }
  }

  async function restorePresets() {
    setRestoring(true);
    try {
      const r = await fetch("/api/vault/presets", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.status === 423) return relock();
      if (!r.ok) throw new Error(d.error || "افزودن انجام نشد.");
      setItems((list) => [...d.secrets, ...list]);
      router.refresh(); // keeps the suggested entries in their usual order
      toast("پیشنهادها اضافه شدند", { kind: "success", duration: 2200 });
    } catch (e) {
      toast(e.message, { kind: "error", duration: 3200 });
    } finally {
      setRestoring(false);
    }
  }

  async function lockNow() {
    await fetch("/api/vault/unlock", { method: "DELETE" }).catch(() => {});
    router.refresh();
  }

  function applySaved(saved, isNew) {
    setItems((list) => (isNew ? [saved, ...list] : list.map((n) => (n.id === saved.id ? saved : n))));
  }

  return (
    <>
      <div className="toolbar">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input type="search" placeholder="جستجو در عنوان و نام کاربری..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="filter-tabs" role="tablist">
          {[["all", "همه"], ["mine", "رمزهای من"], ["withMe", "اشتراکی با من"]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        <button type="button" className="secondary-button" onClick={lockNow} title="قفل کردن بخش رمزها">
          <Icon name="lock" size={16} /> قفل کن
        </button>
        <button type="button" className="primary-button" onClick={() => setEditor({ mode: "create" })}>
          <Icon name="plus" size={18} />
          رمز جدید
        </button>
      </div>

      {missingPresets.length > 0 && (
        <p className="field-hint vault-restore">
          بعضی از رمزهای پیشنهادی (گیت‌هاب، لینکدین، اینستاگرام، ورکورا، بلوبانک) را پاک کرده‌اید.{" "}
          <button type="button" className="link-button" onClick={restorePresets} disabled={restoring}>{restoring ? "در حال افزودن..." : "افزودن دوباره‌ی پیشنهادها"}</button>
        </p>
      )}

      {visible.length === 0 ? (
        <div className="empty-state">
          <h2>{q || filter !== "all" ? "موردی پیدا نشد" : "هنوز رمزی ندارید"}</h2>
          <p>{q || filter !== "all" ? "جستجو یا فیلتر را تغییر دهید." : "رمز اولین حساب خود را اضافه کنید."}</p>
          {!q && filter === "all" && <button type="button" className="primary-button" onClick={() => setEditor({ mode: "create" })}>رمز جدید</button>}
        </div>
      ) : (
        <div className="note-grid">
          {visible.map((n) => (
            <article key={n.id} className="note-card is-config" onClick={() => busyId !== n.id && openItem(n)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openItem(n)}>
              <header className="note-card-head">
                <span className="note-card-icon"><Icon name={PRESET_ICON[n.preset] || "key"} size={18} /></span>
                <h3>{n.title}</h3>
              </header>

              <p className="note-card-meta vault-user">
                {n.username ? n.username : <span className="vault-muted">بدون نام کاربری</span>}
              </p>
              <p className="note-card-meta">
                {n.hasPassword ? (<><Icon name="check" size={13} strokeWidth={2.4} />رمز ذخیره شده · محتوا پنهان است</>) : (<><Icon name="pencil" size={13} />هنوز پر نشده · برای وارد کردن رمز کلیک کنید</>)}
              </p>

              <footer className="note-card-foot">
                <span className={`chip ${n.scope === "private" ? "" : "chip-member"}`}>
                  {n.ownerId === meId ? scopeLabel(n) : `از ${n.ownerName}`}
                </span>
                <small>{n.updatedText}</small>
                <button type="button" className="icon-button note-copy" title="کپی رمز" aria-label="کپی رمز" onClick={(e) => copyFromCard(e, n)} disabled={!n.hasPassword}>
                  <Icon name="copy" size={16} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {editor && (
        <SecretEditor
          key={editor.secret?.id || "new"}
          mode={editor.mode}
          secret={editor.secret}
          members={members}
          meId={meId}
          onClose={() => setEditor(null)}
          onLocked={relock}
          onSaved={(s, isNew) => {
            applySaved(s, isNew);
            toast("ذخیره شد", { kind: "success", duration: 2200 });
          }}
          onDeleted={(id) => {
            setItems((list) => list.filter((n) => n.id !== id));
            toast("حذف شد", { kind: "success", duration: 2200 });
          }}
          onCopy={async (text) => toast((await copyText(text)) ? "کپی شد" : "کپی انجام نشد", { kind: "success", duration: 2000 })}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ add / edit / view one entry */
function SecretEditor({ mode, secret, members, meId, onClose, onSaved, onDeleted, onCopy, onLocked }) {
  const isEdit = mode === "edit";
  const editable = isEdit ? secret.canEdit : true;

  const [form, setForm] = useState({
    title: secret?.title || "",
    username: secret?.username || "",
    password: secret?.password || "",
    url: secret?.url || "",
    note: secret?.note || "",
    scope: secret?.scope || "private",
    sharedWith: secret?.sharedWith || [],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function call(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (response.status === 423) {
      onLocked();
      onClose();
      throw new Error(data.error || "بخش رمزها قفل است.");
    }
    if (!response.ok) throw new Error(data.error || "انجام نشد.");
    return data;
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { title: form.title, username: form.username, password: form.password, url: form.url, note: form.note, scope: form.scope, sharedWith: form.scope === "users" ? form.sharedWith.filter((id) => id !== meId) : [] };
      const data = await call(isEdit ? `/api/vault/${secret.id}` : "/api/vault", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onSaved(data.secret, !isEdit);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/vault/${secret.id}`, { method: "DELETE" });
      onDeleted(secret.id);
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const footer = !editable ? (
    <>
      <button type="button" className="secondary-button" onClick={() => onCopy(form.password)} disabled={!form.password}>کپی رمز</button>
      <button type="button" className="primary-button" onClick={onClose}>بستن</button>
    </>
  ) : confirmDelete ? (
    <>
      <span className="confirm-text">این رمز حذف شود؟ قابل بازگشت نیست.</span>
      <button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)} disabled={busy}>نه</button>
      <button type="button" className="danger-button danger-solid" onClick={remove} disabled={busy}>بله، حذف شود</button>
    </>
  ) : (
    <>
      {isEdit && <button type="button" className="danger-button footer-start" onClick={() => setConfirmDelete(true)} disabled={busy}>حذف</button>}
      <button type="submit" form="vault-form" className="primary-button" disabled={busy}>{busy ? "در حال ذخیره..." : "ذخیره"}</button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={isEdit ? secret.title : "رمز جدید"} size="lg" footer={footer}>
      <form id="vault-form" className="form-grid" onSubmit={save} autoComplete="off">
        <label className="field-wide">
          عنوان
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} disabled={!editable} placeholder="مثلاً گیت‌هاب شرکت" autoFocus={!isEdit} />
        </label>

        <label>
          نام کاربری یا ایمیل
          <input dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} maxLength={200} disabled={!editable} autoComplete="off" placeholder="user@example.com" />
        </label>

        <label>
          آدرس سایت (اختیاری)
          <input dir="ltr" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} maxLength={500} disabled={!editable} autoComplete="off" placeholder="https://..." />
        </label>

        <div className="field-wide vault-label">
          <span>رمز</span>
          <span className="vault-field">
            <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={!editable} autoComplete="new-password" maxLength={2000} placeholder={editable ? "رمز را اینجا وارد کنید" : ""} />
            <button type="button" className="icon-button" onClick={() => setShowPassword((v) => !v)} title={showPassword ? "پنهان کردن" : "نمایش"} aria-label={showPassword ? "پنهان کردن" : "نمایش"}>
              <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
            </button>
            <button type="button" className="icon-button" onClick={() => onCopy(form.password)} disabled={!form.password} title="کپی رمز" aria-label="کپی رمز">
              <Icon name="copy" size={18} />
            </button>
            {editable && (
              <button type="button" className="icon-button" onClick={() => { setForm({ ...form, password: generatePassword() }); setShowPassword(true); }} title="ساخت رمز تصادفی" aria-label="ساخت رمز تصادفی">
                <Icon name="repeat" size={18} />
              </button>
            )}
          </span>
        </div>

        <label className="field-wide">
          توضیحات (اختیاری)
          <textarea rows={4} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} disabled={!editable} maxLength={5000} placeholder="مثلاً سوال امنیتی، کد بازیابی، شماره‌ی مرتبط..." />
        </label>

        <label className="field-wide">
          چه کسانی ببینند؟
          <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} disabled={!editable}>
            <option value="private">فقط خودم</option>
            <option value="users">افراد مشخص</option>
            <option value="workspace">همه‌ی اعضای فضای کاری</option>
          </select>
        </label>

        {form.scope === "users" && (
          <div className="field-wide vault-label">
            <span>این افراد رمز را می‌بینند و می‌توانند کپی کنند</span>
            <MemberPicker members={members} selected={form.sharedWith} lockedIds={[meId]} disabled={!editable} onChange={(ids) => setForm({ ...form, sharedWith: ids })} />
          </div>
        )}

        {editable && form.scope !== "private" && (
          <p className="field-hint field-wide warn-hint">
            {form.scope === "workspace"
              ? "هشدار: همه‌ی اعضای فضای کاری می‌توانند این رمز را ببینند و کپی کنند."
              : "هشدار: هر کسی که انتخاب کنید می‌تواند این رمز را ببیند و کپی کند. فقط شما می‌توانید آن را ویرایش یا حذف کنید."}
          </p>
        )}
        {isEdit && !editable && <p className="field-hint field-wide">فقط سازنده می‌تواند این رمز را ویرایش کند ({secret.ownerName}).</p>}
        {error && <div className="form-error field-wide">{error}</div>}
      </form>
    </Modal>
  );
}
