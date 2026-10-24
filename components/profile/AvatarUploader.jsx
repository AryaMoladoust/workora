"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import { useToast } from "../ui/Feedback";

// Shrinks the chosen photo in the browser (square crop, 320px, JPEG) so the upload is tiny.
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(320, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.86);
}

// Profile photo with a "change" button. `onChange(avatarUrl)` is called after a successful upload / removal.
export default function AvatarUploader({ user, size = "xl", onChange, compact = false }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef(null);
  const [url, setUrl] = useState(user.avatarUrl || null);
  const [busy, setBusy] = useState(false);

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) return toast.error("فقط فایل عکس انتخاب کنید.");
    setBusy(true);
    try {
      const dataUrl = await shrink(file);
      const r = await fetch("/api/profile/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "آپلود عکس انجام نشد.");
      setUrl(d.avatarUrl);
      onChange?.(d.avatarUrl);
      toast.success("عکس پروفایل ذخیره شد");
      router.refresh();
    } catch (e) {
      toast.error(e.message || "آپلود عکس انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const r = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!r.ok) throw new Error("حذف عکس انجام نشد.");
      setUrl(null);
      onChange?.(null);
      router.refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`avatar-uploader${compact ? " is-compact" : ""}`}>
      <span className="avatar-uploader-photo">
        <Avatar user={{ ...user, avatarUrl: url }} size={size} />
        <button type="button" className="avatar-uploader-camera" onClick={() => input.current?.click()} disabled={busy} aria-label="تغییر عکس پروفایل" title="تغییر عکس پروفایل">
          <Icon name="camera" size={16} />
        </button>
      </span>
      {compact && (
        <span className="avatar-uploader-actions">
          <button type="button" className="secondary-button" onClick={() => input.current?.click()} disabled={busy}>{busy ? "در حال ارسال..." : url ? "تغییر عکس" : "انتخاب عکس"}</button>
          {url && <button type="button" className="danger-button" onClick={remove} disabled={busy}>حذف</button>}
        </span>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
    </div>
  );
}
