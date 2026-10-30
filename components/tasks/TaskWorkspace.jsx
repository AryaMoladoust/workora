"use client";

import { useMemo, useState } from "react";
import Icon from "../ui/Icon";
import TaskCard, { Assignee } from "./TaskCard";
import TaskModal from "./TaskModal";
import TaskCalendar from "./TaskCalendar";
import { PRIORITY_LABELS, STATUS_LABELS } from "../../lib/format";
import { canEditTask } from "../../lib/task-rules";

const PRIORITY_WEIGHT = { urgent: 0, high: 1, medium: 2, low: 3 };
const COLUMNS = [
  { id: "todo", color: "var(--c-todo)" },
  { id: "in_progress", color: "var(--c-progress)" },
  { id: "done", color: "var(--c-done)" },
];

function sortTasks(a, b) {
  if (a.status !== b.status) return 0;
  const p = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
  if (p) return p;
  if (a.dueAt && b.dueAt) return new Date(a.dueAt) - new Date(b.dueAt);
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return new Date(b.createdAt) - new Date(a.createdAt);
}

// when a task changes, the tasks that wait for it are unlocked / locked again
function syncBlockers(list, changed) {
  return list.map((t) => {
    if (!t.blockers?.some((b) => b.id === changed.id)) return t;
    const blockers = t.blockers.map((b) => (b.id === changed.id ? { ...b, title: changed.title, done: changed.status === "done" } : b));
    return { ...t, blockers, blocked: t.status !== "done" && blockers.some((b) => !b.done) };
  });
}

function groupOf(task) {
  if (task.status === "done") return "done";
  if (task.dueDiff === null) return "none";
  if (task.dueDiff < 0) return "overdue";
  if (task.dueDiff < 7) return "week";
  return "later";
}

const GROUPS = [
  ["overdue", "عقب‌افتاده"],
  ["week", "۷ روز آینده"],
  ["later", "بعداً"],
  ["none", "بدون مهلت"],
  ["done", "انجام‌شده"],
];

// layout "project": kanban/list toggle for one project. layout "mine": grouped list across projects.
export default function TaskWorkspace({ layout, initialTasks, projects, people, ctx, fixedProjectId, openTaskId }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState(layout === "project" ? "board" : "list");
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [label, setLabel] = useState("all");
  const [modal, setModal] = useState(() => (openTaskId && initialTasks.some((t) => t.id === openTaskId) ? { mode: "edit", id: openTaskId } : null));
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const [collapsed, setCollapsed] = useState({ done: true });

  const peopleById = useMemo(() => new Map(people.map((p) => [p.userId, p])), [people]);
  const canCreate = projects.length > 0;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (needle && !`${t.title} ${t.description}`.toLowerCase().includes(needle)) return false;
        if (priority !== "all" && t.priority !== priority) return false;
        if (assignee === "me" && t.assigneeId !== ctx.userId) return false;
        if (assignee === "none" && t.assigneeId) return false;
        if (assignee !== "all" && assignee !== "me" && assignee !== "none" && t.assigneeId !== assignee) return false;
        if (overdueOnly && !(t.status !== "done" && t.dueTone === "overdue")) return false;
        if (label !== "all" && !(t.labels || []).some((l) => l.name === label)) return false;
        return true;
      })
      .sort(sortTasks);
  }, [tasks, q, priority, assignee, overdueOnly, label, ctx.userId]);

  // label names used by the loaded tasks (labels are per project; the same name in two projects is one filter)
  const labelOptions = useMemo(() => {
    const seen = new Map();
    for (const t of tasks) for (const l of t.labels || []) if (!seen.has(l.name)) seen.set(l.name, l.color);
    return [...seen.entries()];
  }, [tasks]);

  const filtersActive = q || priority !== "all" || assignee !== "all" || overdueOnly || label !== "all";
  const editingTask = modal?.mode === "edit" ? tasks.find((t) => t.id === modal.id) : null;

  // `spawned`: the next copy of a repeating task that was just finished
  function upsert(task, isNew, spawned) {
    setTasks((list) => {
      let next = isNew ? [{ commentCount: 0, ...task }, ...list] : list.map((t) => (t.id === task.id ? { ...t, ...task } : t));
      next = syncBlockers(next, task);
      if (spawned) next = [{ commentCount: 0, ...spawned }, ...next];
      return next;
    });
  }

  async function move(task, status) {
    if (task.status === status) return;
    setError("");
    if (task.blocked && status !== "todo") {
      const waiting = task.blockers.filter((b) => !b.done).map((b) => `«${b.title}»`).join("، ");
      setError(`این وظیفه منتظر ${waiting} است؛ اول آن را انجام دهید.`);
      return;
    }
    const before = tasks;
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status, dueTone: status === "done" ? "none" : t.dueTone } : t)));
    try {
      const response = await fetch(`/api/projects/${task.projectId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "تغییر وضعیت انجام نشد.");
      upsert(data.task, false, data.spawned);
    } catch (err) {
      setTasks(before);
      setError(err.message);
    }
  }

  function commentDelta(taskId, delta) {
    setTasks((list) => list.map((t) => (t.id === taskId ? { ...t, commentCount: Math.max(0, (t.commentCount || 0) + delta) } : t)));
  }

  const rules = (task) => canEditTask(ctx, task);
  const assigneeOptions = people.filter((p) => tasks.some((t) => t.assigneeId === p.userId));

  function renderBoard() {
    return (
      <div className="kanban">
        {COLUMNS.map((col) => {
          const items = filtered.filter((t) => t.status === col.id);
          return (
            <section
              key={col.id}
              className={`kcol ${dragOver === col.id ? "is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.id);
              }}
              onDragLeave={() => setDragOver((v) => (v === col.id ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/plain");
                const task = tasks.find((t) => t.id === id);
                if (task && rules(task)) move(task, col.id);
              }}
            >
              <header className="kcol-head">
                <span className="legend-dot" style={{ background: col.color }} />
                <h3>{STATUS_LABELS[col.id]}</h3>
                <span className="chip">{items.length.toLocaleString("fa-IR")}</span>
                {canCreate && (
                  <button type="button" className="icon-button kcol-add" aria-label="وظیفه جدید" onClick={() => setModal({ mode: "create", status: col.id })}>
                    <Icon name="plus" size={16} />
                  </button>
                )}
              </header>
              <div className="kcol-body">
                {items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    person={peopleById.get(task.assigneeId)}
                    showProject={layout !== "project"}
                    canEdit={rules(task)}
                    onOpen={(t) => setModal({ mode: "edit", id: t.id })}
                    onMove={move}
                    draggable={rules(task)}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                  />
                ))}
                {items.length === 0 && <div className="kcol-empty">{filtersActive ? "موردی پیدا نشد" : "اینجا خالیه"}</div>}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  function row(task) {
    return (
      <li key={task.id}>
        <div className="lrow" role="button" tabIndex={0} onClick={() => setModal({ mode: "edit", id: task.id })} onKeyDown={(e) => e.key === "Enter" && setModal({ mode: "edit", id: task.id })}>
          <span className={`prio-dot prio-${task.priority}`} title={`اولویت ${PRIORITY_LABELS[task.priority]}`} />
          <span className="lrow-main">
            <strong>{task.title}</strong>
            {layout !== "project" && task.projectName && <small>{task.projectName}</small>}
          </span>
          {(task.labels || []).slice(0, 2).map((l) => <span key={l.id} className="label-chip is-static" style={{ "--lc": l.color }}>{l.name}</span>)}
          {task.progress?.total > 0 && <span className="lrow-steps" title="چک‌لیست">{task.progress.done.toLocaleString("fa-IR")}/{task.progress.total.toLocaleString("fa-IR")}</span>}
          {task.blocked && <span className="badge-blocked" title="منتظر انجام پیش‌نیازها"><Icon name="lock" size={12} />منتظر</span>}
          {task.recurrence && <span className="tcard-repeat" title="وظیفه‌ی تکرارشونده"><Icon name="repeat" size={13} /></span>}
          {task.commentCount > 0 && <span className="tcard-comments"><Icon name="chat" size={13} />{task.commentCount.toLocaleString("fa-IR")}</span>}
          <span className={`chip chip-${task.status}`}>{STATUS_LABELS[task.status]}</span>
          <span className={`due due-${task.dueTone}`}>
            {task.dueText && task.status !== "done" && <Icon name={task.dueTone === "overdue" ? "alert" : "calendar"} size={13} />}
            {task.status !== "done" ? task.dueText : ""}
          </span>
          <Assignee person={peopleById.get(task.assigneeId)} />
          {rules(task) && task.status !== "done" ? (
            <button
              type="button"
              className="lrow-check"
              aria-label="علامت‌گذاری به‌عنوان انجام‌شده"
              title="انجام شد"
              onClick={(e) => {
                e.stopPropagation();
                move(task, "done");
              }}
            >
              <Icon name="check" size={15} strokeWidth={2.6} />
            </button>
          ) : (
            <span className="lrow-check-spacer" />
          )}
        </div>
      </li>
    );
  }

  function renderList() {
    if (layout === "project") {
      return filtered.length ? <ul className="lrows card">{filtered.map(row)}</ul> : null;
    }
    return (
      <div className="stack-wide">
        {GROUPS.map(([id, label]) => {
          const items = filtered.filter((t) => groupOf(t) === id);
          if (!items.length) return null;
          const isCollapsed = collapsed[id];
          return (
            <section key={id} className={`lgroup lgroup-${id}`}>
              <button type="button" className="lgroup-head" onClick={() => setCollapsed({ ...collapsed, [id]: !isCollapsed })} aria-expanded={!isCollapsed}>
                <Icon name="chevronDown" size={16} className={isCollapsed ? "is-closed" : ""} />
                <h3>{label}</h3>
                <span className="chip">{items.length.toLocaleString("fa-IR")}</span>
              </button>
              {!isCollapsed && <ul className="lrows card">{items.map(row)}</ul>}
            </section>
          );
        })}
      </div>
    );
  }

  const emptyAll = tasks.length === 0;

  return (
    <div className="tworkspace">
      <div className="toolbar tw-toolbar">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input type="search" placeholder="جستجو در وظایف..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="tw-select" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="اولویت">
          <option value="all">همه اولویت‌ها</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>اولویت {l}</option>)}
        </select>
        <select className="tw-select" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="مسئول">
          <option value="all">همه مسئول‌ها</option>
          <option value="me">فقط من</option>
          <option value="none">بدون مسئول</option>
          {assigneeOptions.filter((p) => p.userId !== ctx.userId).map((p) => (
            <option key={p.userId} value={p.userId}>{p.firstName} {p.lastName}</option>
          ))}
        </select>
        {labelOptions.length > 0 && (
          <select className="tw-select" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="برچسب">
            <option value="all">همه برچسب‌ها</option>
            {labelOptions.map(([name]) => <option key={name} value={name}>{name}</option>)}
          </select>
        )}
        <button type="button" className={`toggle-chip ${overdueOnly ? "is-on" : ""}`} onClick={() => setOverdueOnly(!overdueOnly)} aria-pressed={overdueOnly}>
          <Icon name="alert" size={15} />
          عقب‌افتاده
        </button>
        {filtersActive && (
          <button type="button" className="link-button" onClick={() => { setQ(""); setPriority("all"); setAssignee("all"); setOverdueOnly(false); setLabel("all"); }}>
            پاک کردن فیلترها
          </button>
        )}

        <div className="tw-actions">
          <div className="view-toggle" role="tablist" aria-label="نوع نمایش">
            {layout === "project" && (
              <button type="button" role="tab" aria-selected={view === "board"} className={view === "board" ? "is-active" : ""} onClick={() => setView("board")}>
                <Icon name="dashboard" size={16} />کانبان
              </button>
            )}
            <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>
              <Icon name="menu" size={16} />لیست
            </button>
            <button type="button" role="tab" aria-selected={view === "calendar"} className={view === "calendar" ? "is-active" : ""} onClick={() => setView("calendar")}>
              <Icon name="calendar" size={16} />تقویم
            </button>
          </div>
          {canCreate && (
            <button type="button" className="primary-button" onClick={() => setModal({ mode: "create" })}>
              <Icon name="plus" size={18} />
              وظیفه جدید
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      {emptyAll ? (
        <div className="empty-state">
          <h2>هنوز وظیفه‌ای وجود ندارد</h2>
          <p>{canCreate ? "اولین وظیفه را بسازید؛ می‌توانید آن را به خودتان یا هر عضو پروژه بسپارید." : "وقتی وظیفه‌ای ثبت یا به شما سپرده شود، اینجا نمایش داده می‌شود."}</p>
          {canCreate && <button type="button" className="primary-button" onClick={() => setModal({ mode: "create" })}>ساخت وظیفه</button>}
        </div>
      ) : view === "calendar" ? (
        <TaskCalendar tasks={filtered} onOpen={(t) => setModal({ mode: "edit", id: t.id })} />
      ) : view === "board" ? (
        renderBoard()
      ) : (
        renderList() || <div className="empty-state"><h2>موردی پیدا نشد</h2><p>فیلترها را تغییر دهید.</p></div>
      )}

      {modal?.mode === "create" && (
        <TaskModal
          mode="create"
          presetStatus={modal.status}
          projects={projects}
          projectTasks={tasks}
          people={people}
          fixedProjectId={fixedProjectId}
          ctx={ctx}
          onClose={() => setModal(null)}
          onSaved={upsert}
          onDeleted={() => {}}
          onCommentDelta={commentDelta}
        />
      )}
      {editingTask && (
        <TaskModal
          key={editingTask.id}
          mode="edit"
          task={editingTask}
          projects={projects}
          projectTasks={tasks}
          people={people}
          fixedProjectId={fixedProjectId}
          ctx={ctx}
          onClose={() => setModal(null)}
          onSaved={upsert}
          onDeleted={(id) =>
            setTasks((list) =>
              list
                .filter((t) => t.id !== id)
                .map((t) => {
                  if (!t.blockers?.some((b) => b.id === id)) return t;
                  const blockers = t.blockers.filter((b) => b.id !== id);
                  return { ...t, blockers, blockedBy: t.blockedBy.filter((x) => x !== id), blocked: t.status !== "done" && blockers.some((b) => !b.done) };
                })
            )
          }
          onCommentDelta={commentDelta}
        />
      )}
    </div>
  );
}
