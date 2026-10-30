"use client";

import { useMemo, useState } from "react";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Comments from "./Comments";
import { PRIORITY_LABELS, STATUS_LABELS } from "../../lib/format";
import { canDeleteTask, canEditTask } from "../../lib/task-rules";
import JalaliDateInput from "../ui/JalaliDateInput";
import { BLOCKERS_MAX, CHECKLIST_MAX, RECURRENCE_LABELS, RECURRENCE_UNITS } from "../../lib/task-constants";

// mode "create": new task. mode "edit": detail view (editable when the user is allowed to).
export default function TaskModal({ mode, task, presetStatus, projects, people, projectTasks = [], fixedProjectId, ctx, onClose, onSaved, onDeleted, onCommentDelta }) {
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
    checklist: (task?.checklist || []).map((i) => ({ ...i })),
    labelIds: task?.labelIds || [],
    recurrence: task?.recurrence || null,
    blockedBy: task?.blockedBy || [],
  });
  const [newStep, setNewStep] = useState("");
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
    // labels and prerequisites belong to one project
    setForm({ ...form, projectId, assigneeId: stillMember ? form.assigneeId : "", labelIds: [], blockedBy: [] });
  }

  /* ---- checklist */
  const setStep = (i, patch) => setForm((f) => ({ ...f, checklist: f.checklist.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  function addStep() {
    const text = newStep.trim();
    if (!text || form.checklist.length >= CHECKLIST_MAX) return;
    setForm((f) => ({ ...f, checklist: [...f.checklist, { text, done: false }] }));
    setNewStep("");
  }
  const stepsDone = form.checklist.filter((s) => s.done).length;

  /* ---- labels / prerequisites */
  const projectLabels = project?.labels || [];
  const toggleLabel = (id) => setForm((f) => ({ ...f, labelIds: f.labelIds.includes(id) ? f.labelIds.filter((x) => x !== id) : [...f.labelIds, id] }));
  const known = useMemo(() => {
    const m = new Map((task?.blockers || []).map((b) => [b.id, { title: b.title, done: b.done }]));
    for (const t of projectTasks) m.set(t.id, { title: t.title, done: t.status === "done" });
    return m;
  }, [task, projectTasks]);
  const blockerChoices = projectTasks.filter((t) => t.projectId === form.projectId && t.id !== task?.id && !form.blockedBy.includes(t.id));

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
        checklist: form.checklist,
        labelIds: form.labelIds,
        recurrence: form.recurrence,
        blockedBy: form.blockedBy,
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
      onSaved(data.task, !isEdit, data.spawned);
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

        <div className="field-wide task-extra">
          <span className="field-label">چک‌لیست{form.checklist.length > 0 && <small> · {stepsDone.toLocaleString("fa-IR")} از {form.checklist.length.toLocaleString("fa-IR")}</small>}</span>
          {form.checklist.length > 0 && (
            <div className="mini-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((stepsDone / form.checklist.length) * 100)}>
              <span style={{ width: `${(stepsDone / form.checklist.length) * 100}%` }} />
            </div>
          )}
          <ul className="cl-list">
            {form.checklist.map((s, i) => (
              <li key={i} className={s.done ? "is-done" : ""}>
                <input type="checkbox" checked={s.done} disabled={!editable} aria-label="انجام شد" onChange={(e) => setStep(i, { done: e.target.checked })} />
                <input className="cl-text" value={s.text} maxLength={200} disabled={!editable} onChange={(e) => setStep(i, { text: e.target.value })} />
                {editable && (
                  <button type="button" className="icon-button" aria-label="حذف مرحله" onClick={() => setForm((f) => ({ ...f, checklist: f.checklist.filter((_, idx) => idx !== i) }))}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && form.checklist.length < CHECKLIST_MAX && (
            <div className="input-with-action">
              <input value={newStep} maxLength={200} placeholder="مرحله‌ی جدید، مثلاً «بررسی»..." onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } }} />
              <button type="button" className="secondary-button" onClick={addStep}>افزودن</button>
            </div>
          )}
        </div>

        {projectLabels.length > 0 && (
          <div className="field-wide task-extra">
            <span className="field-label">برچسب‌ها</span>
            <div className="label-picker">
              {projectLabels.map((l) => (
                <button type="button" key={l.id} disabled={!editable} className={`label-chip ${form.labelIds.includes(l.id) ? "is-on" : ""}`} style={{ "--lc": l.color }} aria-pressed={form.labelIds.includes(l.id)} onClick={() => toggleLabel(l.id)}>
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field-wide task-extra rec-edit">
          <span className="field-label"><Icon name="repeat" size={14} /> تکرار</span>
          <div className="rec-row">
            <select aria-label="تکرار" value={form.recurrence?.every || ""} disabled={!editable} onChange={(e) => setForm({ ...form, recurrence: e.target.value ? { every: e.target.value, interval: form.recurrence?.interval || 1 } : null })}>
              <option value="">تکرار نمی‌شود</option>
              {Object.entries(RECURRENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {form.recurrence && (
              <label className="rec-interval">
                هر
                <input type="number" min={1} max={30} value={form.recurrence.interval} disabled={!editable} onChange={(e) => setForm({ ...form, recurrence: { ...form.recurrence, interval: Math.min(30, Math.max(1, Number(e.target.value) || 1)) } })} />
                {RECURRENCE_UNITS[form.recurrence.every]}
              </label>
            )}
          </div>
          {form.recurrence && <p className="field-hint">{form.dueAt ? "وقتی این وظیفه انجام شد، نسخه‌ی بعدی با مهلت جدید ساخته می‌شود." : "برای تکرار باید مهلت را مشخص کنید."}</p>}
        </div>

        <div className="field-wide task-extra">
          <span className="field-label"><Icon name="lock" size={14} /> پیش‌نیازها <small>· این وظیفه بعد از انجام این‌ها شروع می‌شود</small></span>
          {form.blockedBy.length > 0 && (
            <ul className="blocker-list">
              {form.blockedBy.map((id) => {
                const b = known.get(id) || { title: "وظیفه", done: false };
                return (
                  <li key={id} className={b.done ? "is-done" : ""}>
                    <Icon name={b.done ? "check" : "clock"} size={14} />
                    <span>{b.title}</span>
                    {editable && <button type="button" className="icon-button" aria-label="حذف پیش‌نیاز" onClick={() => setForm((f) => ({ ...f, blockedBy: f.blockedBy.filter((x) => x !== id) }))}><Icon name="close" size={14} /></button>}
                  </li>
                );
              })}
            </ul>
          )}
          {editable && form.blockedBy.length < BLOCKERS_MAX && blockerChoices.length > 0 && (
            <select aria-label="افزودن پیش‌نیاز" value="" onChange={(e) => e.target.value && setForm((f) => ({ ...f, blockedBy: [...f.blockedBy, e.target.value] }))}>
              <option value="">+ افزودن پیش‌نیاز...</option>
              {blockerChoices.map((t) => <option key={t.id} value={t.id}>{t.title}{t.status === "done" ? " (انجام‌شده)" : ""}</option>)}
            </select>
          )}
          {form.blockedBy.length === 0 && blockerChoices.length === 0 && <p className="field-hint">وظیفه‌ی دیگری در این پروژه برای انتخاب نیست.</p>}
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
