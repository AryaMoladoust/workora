"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "../ui/Modal";

export default function DeleteProject({ projectId, projectName }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "حذف پروژه انجام نشد.");
      router.replace("/projects");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card danger-zone">
        <div>
          <h3>حذف پروژه</h3>
          <p>با حذف پروژه، همه وظایف آن هم برای همیشه پاک می‌شود. اگر فقط می‌خواهید کار تمام شود، وضعیت را «بایگانی» کنید.</p>
        </div>
        <button type="button" className="danger-button" onClick={() => setOpen(true)}>حذف پروژه</button>
      </section>

      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="حذف پروژه؟"
        size="sm"
        footer={
          <>
            <button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={loading}>انصراف</button>
            <button type="button" className="danger-button danger-solid" onClick={remove} disabled={loading}>{loading ? "در حال حذف..." : "بله، حذف شود"}</button>
          </>
        }
      >
        <p>پروژه «{projectName}» و همه وظایفش حذف می‌شود. این کار قابل بازگشت نیست.</p>
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
      </Modal>
    </>
  );
}
