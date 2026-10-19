"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

// Glass-style in-app notifications for the whole app:
//   const toast = useToast();   toast.success("ذخیره شد")   toast.error("...")   toast.info("...")   toast({ title, body, href, kind: "chat" })
//   const confirm = useConfirm();   if (!(await confirm({ title, message, confirmLabel, danger: true }))) return;
// They replace window.alert / window.confirm so nothing in the app opens the browser's own dialogs.

const FeedbackContext = createContext(null);

const KIND_ICON = { success: "check", error: "alert", info: "bell", chat: "chat", warning: "alert" };
const MAX_TOASTS = 4;
let counter = 0;

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}
export const useToast = () => useFeedback().toast;
export const useConfirm = () => useFeedback().confirm;

function Toast({ item, onClose, onOpen }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);
  const left = useRef(item.duration);
  const started = useRef(0);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onClose(item.id), 220);
  }, [item.id, onClose]);

  const start = useCallback(() => {
    started.current = Date.now();
    clearTimeout(timer.current);
    timer.current = setTimeout(close, left.current);
  }, [close]);

  const pause = useCallback(() => {
    clearTimeout(timer.current);
    left.current = Math.max(1200, left.current - (Date.now() - started.current));
  }, []);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  const clickable = Boolean(item.href);
  return (
    <div
      className={`gtoast gtoast-${item.kind}${leaving ? " is-leaving" : ""}${clickable ? " is-clickable" : ""}`}
      role={item.kind === "error" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={start}
      onClick={clickable ? () => { onOpen(item); close(); } : undefined}
      style={{ "--dur": `${item.duration}ms` }}
    >
      <span className="gtoast-icon"><Icon name={KIND_ICON[item.kind] || "bell"} size={18} strokeWidth={2.2} /></span>
      <span className="gtoast-text">
        {item.title && <strong>{item.title}</strong>}
        {item.body && <span>{item.body}</span>}
      </span>
      <button type="button" className="gtoast-close" aria-label="بستن" onClick={(e) => { e.stopPropagation(); close(); }}>
        <Icon name="close" size={14} />
      </button>
      <span className="gtoast-bar" aria-hidden="true" />
    </div>
  );
}

function ConfirmDialog({ state, onAnswer }) {
  const okRef = useRef(null);
  useEffect(() => {
    if (!state) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    okRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") onAnswer(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [state, onAnswer]);
  if (!state) return null;
  return (
    <div className="gconfirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onAnswer(false)}>
      <div className={`gconfirm${state.danger ? " is-danger" : ""}`} role="alertdialog" aria-modal="true" aria-label={state.title}>
        <span className="gconfirm-icon"><Icon name={state.danger ? "trash" : "alert"} size={22} /></span>
        <h3>{state.title}</h3>
        {state.message && <p>{state.message}</p>}
        <div className="gconfirm-actions">
          <button type="button" className="gconfirm-btn" onClick={() => onAnswer(false)}>{state.cancelLabel}</button>
          <button type="button" ref={okRef} className={`gconfirm-btn is-primary${state.danger ? " is-danger" : ""}`} onClick={() => onAnswer(true)}>{state.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackProvider({ children }) {
  const router = useRouter();
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [mounted, setMounted] = useState(false);
  const resolver = useRef(null);

  useEffect(() => setMounted(true), []);

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback((input, kindOrOptions) => {
    const base = typeof input === "string" ? { body: input } : input || {};
    const extra = typeof kindOrOptions === "string" ? { kind: kindOrOptions } : kindOrOptions || {};
    const item = { kind: "info", duration: 4500, ...base, ...extra, id: `t${(counter += 1)}` };
    if (item.kind === "error") item.duration = Math.max(item.duration, 6500);
    setToasts((list) => {
      // identical text right after each other is shown once
      if (list.some((t) => t.title === item.title && t.body === item.body && t.kind === item.kind)) return list;
      return [...list, item].slice(-MAX_TOASTS);
    });
    return item.id;
  }, []);

  const toast = useMemo(() => {
    const fn = (input, options) => show(input, options);
    fn.success = (message, options) => show(message, { kind: "success", ...options });
    fn.error = (message, options) => show(message, { kind: "error", ...options });
    fn.info = (message, options) => show(message, { kind: "info", ...options });
    fn.dismiss = remove;
    return fn;
  }, [show, remove]);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        if (resolver.current) resolver.current(false);
        resolver.current = resolve;
        const o = typeof options === "string" ? { message: options } : options;
        setConfirmState({ title: "آیا مطمئن هستید؟", confirmLabel: "تأیید", cancelLabel: "انصراف", danger: false, ...o });
      }),
    []
  );

  const answer = useCallback((value) => {
    const resolve = resolver.current;
    resolver.current = null;
    setConfirmState(null);
    resolve?.(value);
  }, []);

  const open = useCallback(
    (item) => {
      try {
        const u = new URL(item.href, window.location.origin);
        if (u.origin === window.location.origin) router.push(`${u.pathname}${u.search}${u.hash}`);
      } catch {
        /* ignore bad links */
      }
    },
    [router]
  );

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <>
            <div className="gtoast-stack" aria-live="polite">
              {toasts.map((t) => <Toast key={t.id} item={t} onClose={remove} onOpen={open} />)}
            </div>
            <ConfirmDialog state={confirmState} onAnswer={answer} />
          </>,
          document.body
        )}
    </FeedbackContext.Provider>
  );
}
