"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "../ui/Feedback";
import { STATUS_LABELS, PRIORITY_LABELS } from "../../lib/format";

// Stage 2 keeps the existing task logic (create / change status / delete) inside the new design.
// Stage 3 replaces this with the full task experience (assignees, kanban, filters, comments).
export default function ProjectTasks({ projectId, canManage }) {
  const confirm = useConfirm();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tasks`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "خطا");
        setTasks(d.tasks);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function createTask(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, priority }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "ایجاد وظیفه ناموفق بود.");
      setTasks((x) => [d.task, ...x]);
      setTitle("");
      setDescription("");
      setPriority("medium");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(task, status) {
    const r = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await r.json();
    if (r.ok) setTasks((x) => x.map((t) => (t.id === task.id ? d.task : t)));
    else setError(d.error || "ویرایش انجام نشد.");
  }

  async function removeTask(task) {
    if (!(await confirm({ title: "حذف وظیفه", message: "این وظیفه حذف شود؟", confirmLabel: "حذف", danger: true }))) return;
    const r = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE" });
    const d = await r.json();
    if (r.ok) setTasks((x) => x.filter((t) => t.id !== task.id));
    else setError(d.error || "حذف انجام نشد.");
  }

  return (
    <div className={`task-layout ${canManage ? "" : "task-layout-single"}`}>
      {canManage && (
        <form className="card form-grid task-create" onSubmit={createTask}>
          <h2 className="field-wide">وظیفه جدید</h2>
          <label className="field-wide">عنوان<input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={240} /></label>
          <label className="field-wide">توضیحات<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={10000} /></label>
          <label className="field-wide">
            اولویت
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {error && <div className="form-error field-wide">{error}</div>}
          <button className="primary-button field-wide" disabled={saving}>{saving ? "در حال ذخیره..." : "ایجاد وظیفه"}</button>
        </form>
      )}

      <section className="tasks-panel">
        {!canManage && error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
        {loading ? (
          <div className="empty-state"><p>در حال دریافت وظایف...</p></div>
        ) : tasks.length === 0 ? (
          <div className="empty-state"><h2>هنوز وظیفه‌ای وجود ندارد</h2><p>{canManage ? "اولین وظیفه را ایجاد کنید." : "وقتی وظیفه‌ای ثبت شود اینجا دیده می‌شود."}</p></div>
        ) : (
          <div className="task-list-real">
            {tasks.map((task) => (
              <article className="task-card-real" key={task.id}>
                <div className="task-card-top">
                  <div>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                  </div>
                  <span className={`priority priority-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
                </div>
                <div className="task-card-bottom">
                  {canManage ? (
                    <select value={task.status} onChange={(e) => changeStatus(task, e.target.value)}>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ) : (
                    <span className={`chip chip-${task.status}`}>{STATUS_LABELS[task.status]}</span>
                  )}
                  {canManage && <button type="button" className="danger-button" onClick={() => removeTask(task)}>حذف</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
