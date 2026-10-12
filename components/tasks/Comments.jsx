"use client";

import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { hueFromString, initials } from "../../lib/format";
import { canDeleteComment } from "../../lib/task-rules";

export default function Comments({ projectId, taskId, ctx, onCountChange }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/projects/${projectId}/tasks/${taskId}/comments`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "دریافت کامنت‌ها انجام نشد.");
        if (alive) setComments(d.comments);
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setComments([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [projectId, taskId]);

  async function send(event) {
    event.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      const r = await fetch(`/api/projects/${projectId}/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "ثبت کامنت انجام نشد.");
      setComments((list) => [...(list || []), d.comment]);
      setText("");
      onCountChange?.(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function remove(comment) {
    setError("");
    const r = await fetch(`/api/projects/${projectId}/tasks/${taskId}/comments/${comment.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error || "حذف کامنت انجام نشد.");
      return;
    }
    setComments((list) => list.filter((c) => c.id !== comment.id));
    onCountChange?.(-1);
  }

  return (
    <section className="comments">
      <h4 className="comments-title">
        <Icon name="chat" size={17} />
        کامنت‌ها
        {comments && <span className="chip">{comments.length.toLocaleString("fa-IR")}</span>}
      </h4>

      {comments === null ? (
        <p className="field-hint">در حال دریافت...</p>
      ) : comments.length === 0 ? (
        <p className="field-hint">هنوز کامنتی ثبت نشده.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <span className="avatar avatar-sm" style={{ "--h": hueFromString(c.authorId) }}>
                {initials(c.authorName.split(" ")[0], c.authorName.split(" ").slice(1).join(" "))}
              </span>
              <div className="comment-body">
                <div className="comment-head">
                  <strong>{c.authorName}</strong>
                  <small>{c.createdText}</small>
                  {canDeleteComment(ctx, c) && (
                    <button type="button" className="comment-delete" aria-label="حذف کامنت" onClick={() => remove(c)}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="comment-form" onSubmit={send}>
        <textarea
          rows={2}
          value={text}
          maxLength={3000}
          placeholder="یک کامنت بنویسید..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send(e);
          }}
        />
        <button className="primary-button" disabled={sending || !text.trim()}>{sending ? "..." : "ارسال"}</button>
      </form>
      {error && <div className="form-error">{error}</div>}
    </section>
  );
}
