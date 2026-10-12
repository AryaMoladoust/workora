"use client";

import Icon from "./Icon";
import { initials, hueFromString } from "../../lib/format";

// Checkbox list of workspace members. `lockedIds` are always selected and cannot be unchecked.
export default function MemberPicker({ members, selected, onChange, lockedIds = [], disabled = false }) {
  function toggle(userId) {
    if (disabled || lockedIds.includes(userId)) return;
    onChange(selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId]);
  }

  if (members.length === 0) {
    return <p className="field-hint">هنوز عضوی در فضای کاری وجود ندارد.</p>;
  }

  return (
    <ul className="picker-list">
      {members.map((m) => {
        const checked = selected.includes(m.userId) || lockedIds.includes(m.userId);
        const locked = lockedIds.includes(m.userId);
        return (
          <li key={m.userId}>
            <button
              type="button"
              className={`picker-row ${checked ? "is-checked" : ""}`}
              onClick={() => toggle(m.userId)}
              disabled={disabled || locked}
              aria-pressed={checked}
            >
              <span className="avatar avatar-sm" style={{ "--h": hueFromString(m.userId) }}>{initials(m.firstName, m.lastName)}</span>
              <span className="picker-name">
                {m.firstName} {m.lastName}
                {locked && <small>(شما)</small>}
              </span>
              <span className="picker-role">{m.role === "owner" ? "مالک" : "عضو"}</span>
              <span className="picker-check">{checked && <Icon name="check" size={14} strokeWidth={3} />}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
