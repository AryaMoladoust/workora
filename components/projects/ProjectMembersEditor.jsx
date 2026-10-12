"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MemberPicker from "../ui/MemberPicker";

export default function ProjectMembersEditor({ projectId, members, initialMemberIds }) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialMemberIds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const changed =
    selected.length !== initialMemberIds.length || selected.some((id) => !initialMemberIds.includes(id));

  async function save() {
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: selected }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ذخیره اعضا انجام نشد.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="members-editor">
      <MemberPicker members={members} selected={selected} onChange={(ids) => { setSelected(ids); setSaved(false); }} />
      {error && <div className="form-error">{error}</div>}
      {saved && !changed && <div className="form-success">اعضای پروژه ذخیره شد.</div>}
      <div className="form-actions">
        <button type="button" className="primary-button" disabled={!changed || loading} onClick={save}>
          {loading ? "در حال ذخیره..." : "ذخیره اعضا"}
        </button>
        {changed && (
          <button type="button" className="secondary-button" onClick={() => setSelected(initialMemberIds)}>بازگردانی</button>
        )}
      </div>
    </div>
  );
}
