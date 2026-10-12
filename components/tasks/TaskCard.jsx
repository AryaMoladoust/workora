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

      <div className="tcard-meta">
        <span className={`priority priority-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
        {task.dueText && task.status !== "done" && (
          <span className={`due due-${task.dueTone}`}>
            <Icon name={task.dueTone === "overdue" ? "alert" : "calendar"} size={13} />
            {task.dueText}
          </span>
        )}
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
