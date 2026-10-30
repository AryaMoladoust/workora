"use client";

import Icon from "../ui/Icon";
import { PRIORITY_LABELS, STATUS_LABELS, hueFromString, initials } from "../../lib/format";

const NEXT = { todo: ["in_progress", "شروع کار"], in_progress: ["done", "انجام شد"] };

export function Assignee({ person }) {
  if (!person) return <span className="assignee-none" title="بدون مسئول">—</span>;
  return (
    <span className="avatar avatar-sm" style={{ "--h": hueFromString(person.userId) }} title={`${person.firstName} ${person.lastName}`}>
      {initials(person.firstName, person.lastName)}
    </span>
  );
}

export default function TaskCard({ task, person, showProject, canEdit, onOpen, onMove, draggable, onDragStart }) {
  const next = NEXT[task.status];
  return (
    <article
      className={`tcard prio-border-${task.priority} ${task.status === "done" ? "is-done" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onOpen(task)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task);
      }}
    >
      {showProject && task.projectName && <small className="tcard-project">{task.projectName}</small>}
      <h4 className="tcard-title">{task.title}</h4>

      {task.labels?.length > 0 && (
        <div className="tcard-labels">
          {task.labels.slice(0, 3).map((l) => (
            <span key={l.id} className="label-chip is-static" style={{ "--lc": l.color }}>{l.name}</span>
          ))}
          {task.labels.length > 3 && <span className="label-chip is-static">+{task.labels.length - 3}</span>}
        </div>
      )}
      {task.progress?.total > 0 && (
        <div className="tcard-progress" title={`${task.progress.done} از ${task.progress.total} مرحله`}>
          <div className="mini-progress"><span style={{ width: `${task.progress.percent}%` }} /></div>
          <small>{task.progress.done.toLocaleString("fa-IR")}/{task.progress.total.toLocaleString("fa-IR")}</small>
        </div>
      )}

      <div className="tcard-meta">
        <span className={`priority priority-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
        {task.dueText && task.status !== "done" && (
          <span className={`due due-${task.dueTone}`}>
            <Icon name={task.dueTone === "overdue" ? "alert" : "calendar"} size={13} />
            {task.dueText}
          </span>
        )}
        {task.blocked && (
          <span className="badge-blocked" title={`منتظر: ${task.blockers.filter((b) => !b.done).map((b) => b.title).join("، ")}`}>
            <Icon name="lock" size={12} />
            منتظر {task.blockers.filter((b) => !b.done).length.toLocaleString("fa-IR")}
          </span>
        )}
        {task.recurrence && <span className="tcard-repeat" title="وظیفه‌ی تکرارشونده"><Icon name="repeat" size={13} /></span>}
        {task.commentCount > 0 && (
          <span className="tcard-comments"><Icon name="chat" size={13} />{task.commentCount.toLocaleString("fa-IR")}</span>
        )}
        <span className="tcard-assignee"><Assignee person={person} /></span>
      </div>

      {canEdit && next && onMove && (
        <button
          type="button"
          className="tcard-advance"
          onClick={(e) => {
            e.stopPropagation();
            onMove(task, next[0]);
          }}
        >
          <Icon name={next[0] === "done" ? "check" : "arrowLeft"} size={14} strokeWidth={2.4} />
          {next[1]}
        </button>
      )}
      {task.status === "done" && <span className="tcard-donebadge"><Icon name="check" size={13} strokeWidth={2.6} />{STATUS_LABELS.done}</span>}
    </article>
  );
}
