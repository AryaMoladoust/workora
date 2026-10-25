"use client";

import { useMemo, useState } from "react";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import ChatAvatar from "./ChatAvatar";

const JSON_HEADERS = { "Content-Type": "application/json" };

// Members + settings of a custom group. Everybody sees the members; the manager (the person who created the group,
// or whoever it was handed over to) can rename it, add / remove people and hand the group over.
export default function GroupManager({ open, onClose, conversation, meId, ownerId, participants, people, onChanged, onLeaveGroup, onDeleteGroup }) {
  const confirm = useConfirm();
  const toast = useToast();
  const isManager = ownerId ? ownerId === meId : Boolean(conversation.isCreator);
  const [name, setName] = useState(conversation.title);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState([]);
  const [query, setQuery] = useState("");

  const memberIds = useMemo(() => new Set(participants.map((p) => p.id)), [participants]);
  const needle = query.trim().toLowerCase();
  const addable = people.filter((p) => !memberIds.has(p.userId) && `${p.firstName} ${p.lastName}`.toLowerCase().includes(needle));

  async function send(body, key) {
    setBusy(key);
    setError("");
    try {
      const r = await fetch(`/api/chat/conversations/${conversation.id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "انجام نشد.");
      onChanged?.(d.conversation);
      return d;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function rename(e) {
    e.preventDefault();
    if (name.trim() === conversation.title) return;
    if (await send({ name: name.trim() }, "name")) toast.success("نام گروه تغییر کرد");
  }

  async function removeMember(p) {
    const ok = await confirm({ title: "حذف از گروه", message: `«${p.name}» از گروه حذف می‌شود و پیام‌های گروه را دیگر نمی‌بیند.`, confirmLabel: "حذف از گروه", danger: true });
    if (ok && (await send({ removeMemberId: p.id }, `rm-${p.id}`))) toast.success(`${p.name} از گروه حذف شد`);
  }

  async function makeManager(p) {
    const ok = await confirm({ title: "انتقال مدیریت گروه", message: `«${p.name}» مدیر گروه می‌شود و شما دیگر نمی‌توانید اعضا را مدیریت کنید یا گروه را حذف کنید.`, confirmLabel: "انتقال مدیریت" });
    if (ok && (await send({ transferTo: p.id }, `mg-${p.id}`))) toast.success(`${p.name} مدیر گروه شد`);
  }

  async function addMembers() {
    if (!picked.length) return;
    if (await send({ addMemberIds: picked }, "add")) {
      toast.success(picked.length === 1 ? "عضو جدید اضافه شد" : `${picked.length.toLocaleString("fa-IR")} عضو جدید اضافه شد`);
      setPicked([]);
      setQuery("");
    }
  }

  const toggle = (id) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="اعضا و مدیریت گروه"
      size="md"
      footer={
        <>
          <button type="button" className="danger-button" onClick={() => { onClose(); onLeaveGroup?.(); }}>
            <Icon name="logout" size={16} />
            خروج از گروه
          </button>
          {isManager && (
            <button type="button" className="danger-button" onClick={() => { onClose(); onDeleteGroup?.(); }}>
              <Icon name="trash" size={16} />
              حذف گروه
            </button>
          )}
        </>
      }
    >
      <div className="group-manager">
        {isManager ? (
          <form className="gm-rename" onSubmit={rename}>
            <label>
              نام گروه
              <div className="input-with-action">
                <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                <button type="submit" className="secondary-button" disabled={busy === "name" || name.trim().length < 2 || name.trim() === conversation.title}>
                  {busy === "name" ? "..." : "ذخیره"}
                </button>
              </div>
            </label>
          </form>
        ) : (
          <p className="field-hint">فقط مدیر گروه می‌تواند نام گروه و اعضا را تغییر دهد.</p>
        )}

        <section aria-label="اعضای گروه">
          <h4 className="gm-title">اعضا ({participants.length.toLocaleString("fa-IR")})</h4>
          <ul className="gm-members">
            {participants.map((p) => {
              const manager = p.id === ownerId;
              const self = p.id === meId;
              return (
                <li key={p.id}>
                  <ChatAvatar id={p.id} name={p.name} size="sm" src={p.avatarUrl} />
                  <span className="gm-name">
                    {p.name}
                    {self && <small> (شما)</small>}
                  </span>
                  {manager && <span className="chip chip-owner">مدیر گروه</span>}
                  {isManager && !self && (
                    <span className="gm-actions">
                      <button type="button" className="icon-button" title="انتقال مدیریت به این فرد" aria-label={`انتقال مدیریت به ${p.name}`} disabled={Boolean(busy)} onClick={() => makeManager(p)}>
                        <Icon name="user" size={15} />
                      </button>
                      <button type="button" className="icon-button" title="حذف از گروه" aria-label={`حذف ${p.name} از گروه`} disabled={Boolean(busy)} onClick={() => removeMember(p)}>
                        <Icon name="close" size={15} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {isManager && (
          <section aria-label="افزودن عضو">
            <h4 className="gm-title">افزودن عضو</h4>
            {people.length === 0 || (addable.length === 0 && !needle) ? (
              <p className="field-hint">همه‌ی اعضای فضای کاری در این گروه هستند.</p>
            ) : (
              <>
                <input type="search" value={query} placeholder="جستجوی همکار..." onChange={(e) => setQuery(e.target.value)} />
                <ul className="gm-add">
                  {addable.map((p) => (
                    <li key={p.userId}>
                      <label>
                        <input type="checkbox" checked={picked.includes(p.userId)} onChange={() => toggle(p.userId)} />
                        <ChatAvatar id={p.userId} name={`${p.firstName} ${p.lastName}`} size="sm" />
                        <span>{p.firstName} {p.lastName}</span>
                      </label>
                    </li>
                  ))}
                  {addable.length === 0 && <li className="field-hint">موردی پیدا نشد.</li>}
                </ul>
                <button type="button" className="primary-button" disabled={!picked.length || Boolean(busy)} onClick={addMembers}>
                  <Icon name="plus" size={16} />
                  {busy === "add" ? "در حال افزودن..." : picked.length ? `افزودن ${picked.length.toLocaleString("fa-IR")} نفر` : "افزودن"}
                </button>
              </>
            )}
          </section>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
