"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";

export default function WorkspaceForm({ initialName }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ذخیره نشد.");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card settings-card">
      <div className="card-head">
        <h2 className="card-title"><span className="card-title-icon"><Icon name="settings" size={17} /></span>فضای کاری</h2>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label className="field-wide">نام فضای کاری<input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></label>
        {error && <div className="form-error field-wide">{error}</div>}
        {saved && <div className="auth-success field-wide" role="status">نام فضای کاری ذخیره شد.</div>}
        <div className="field-wide settings-actions"><button className="primary-button" disabled={busy || !name.trim()}>{busy ? "در حال ذخیره..." : "ذخیره"}</button></div>
      </form>
    </section>
  );
}
