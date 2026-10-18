"use client";

import { useMemo, useState } from "react";
import Modal from "../ui/Modal";
import Comments from "./Comments";
import { PRIORITY_LABELS, STATUS_LABELS } from "../../lib/format";
import { canDeleteTask, canEditTask } from "../../lib/task-rules";
import JalaliDateInput from "../ui/JalaliDateInput";

// mode "create": new task. mode "edit": detail view (editable when the user is allowed to).
export default function TaskModal({ mode, task, presetStatus, projects, people, fixedProjectId, ctx, onClose, onSaved, onDeleted, onCommentDelta }) {
  const isEdit = mode === "edit";
  const editable = isEdit ? canEditTask(ctx, task) : true;
  const deletable = isEdit && canDeleteTask(ctx, task);

  const firstProject = fixedProjectId || (isEdit ? task.projectId : projects[0]?.id || "");
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    projectId: firstProject,
    status: task?.status || presetStatus || "todo",
    priority: task?.priority || "medium",
    assigneeId: isEdit ? task.assigneeId || "" : ctx.userId,
    startAt: task?.startInput || "",
    dueAt: task?.dueInput || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const project = projects.find((p) => p.id === form.projectId);
  const assignable = useMemo(() => {
    const ids = project?.memberIds || [];
    return people.filter((p) => ids.includes(p.userId) && (p.isActive || p.userId === form.assigneeId));
  }, [people, project, form.assigneeId]);

  function setProject(projectId) {
    const next = projects.find((p) => p.id === projectId);
    const stillMember = next?.memberIds.includes(form.assigneeId);
    setForm({ ...form, projectId, assigneeId: stillMember ? form.assigneeId : "" });
  }

  async function submit(event) {
    event.preventDefault();
    if (!editable) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        assigneeId: form.assigneeId || null,
        startAt: form.startAt || null,
        dueAt: form.dueAt || null,
      };
      const url = isEdit
        ? `/api/projects/${task.projectId}/tasks/${task.id}`
        : `/api/projects/${form.projectId}/tasks`;
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ذخیره وظیفه انجام نشد.");
      onSaved(data.task, !isEdit);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${task.projectId}/tasks/${task.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "حذف وظیفه انجام نشد.");
      onDeleted(task.id);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const footer = !editable ? (
    <button type="button" className="secondary-button" onClick={onClose}>بستن</button>
  ) : confirmDelete ? (
    <>
      <span className="confirm-text">این وظیفه و کامنت‌هایش حذف شود؟</span>
      <button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)} disabled={busy}>نه</button>
      <button type="button" className="danger-button danger-solid" onClick={remove} disabled={busy}>بله، حذف شود</button>
    </>
  ) : (
    <>
      {deletable && (
        <button type="button" className="danger-button footer-start" onClick={() => setConfirmDelete(true)} disabled={busy}>حذف</button>
      )}
      <button type="button" className="secondary-button" onClick={onClose}>انصراف</button>
      <button type="submit" form="task-form" className="primary-button" disabled={busy}>
        {busy ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ایجاد وظیفه"}
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={isEdit ? "جزئیات وظیفه" : "وظیفه جدید"} size="lg" footer={footer}>
      <form id="task-form" className="form-grid" onSubmit={submit}>
        {!isEdit && !fixedProjectId && projects.length > 1 && (
          <label className="field-wide">
            پروژه
            <select value={form.projectId} onChange={(e) => setProject(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        {isEdit && task.projectName && !fixedProjectId && (
          <div className="field-wide task-project-line">پروژه: <strong>{task.projectName}</strong></div>
        )}

        <label className="field-wide">
          عنوان
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={240} disabled={!editable} autoFocus={!isEdit} placeholder="مثلاً طراحی صفحه ورود" />
        </label>

        <label className="field-wide">
          توضیحات
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={10000} disabled={!editable} />
        </label>

        <label className="field-wide">
          مسئول انجام
          <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} disabled={!editable}>
            <option value="">بدون مسئول</option>
            {assignable.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.firstName} {p.lastName}{p.userId === ctx.userId ? " (من)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          وضعیت
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={!editable}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <label>
          اولویت
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} disabled={!editable}>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <div className="form-grid-inner">
          <label>
            شروع
            <JalaliDateInput value={form.startAt} onChange={(v) => setForm({ ...form, startAt: v })} disabled={!editable} />
          </label>
          <label>
            مهلت
            <JalaliDateInput value={form.dueAt} min={form.startAt || undefined} onChange={(v) => setForm({ ...form, dueAt: v })} disabled={!editable} />
          </label>
        </div>

        {!editable && <p className="field-hint field-wide">فقط سازنده، مسئول وظیفه و مدیران می‌توانند این وظیفه را ویرایش کنند.</p>}
        {error && <div className="form-error field-wide">{error}</div>}
      </form>

      {isEdit && (
        <Comments projectId={task.projectId} taskId={task.id} ctx={ctx} onCountChange={(d) => onCommentDelta(task.id, d)} />
      )}
    </Modal>
  );
}
