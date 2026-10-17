"use client";

import { useState } from "react";
import { EMOJI_CATEGORIES } from "./emoji-data";

// Small emoji palette used inside the message bar. `data-pop` lets the thread close it on outside clicks.
export default function EmojiPicker({ onPick }) {
  const [tab, setTab] = useState(EMOJI_CATEGORIES[0].id);
  const category = EMOJI_CATEGORIES.find((c) => c.id === tab) || EMOJI_CATEGORIES[0];

  return (
    <div className="emoji-picker" data-pop role="dialog" aria-label="انتخاب ایموجی">
      <div className="emoji-tabs" role="tablist">
        {EMOJI_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === tab}
            title={c.label}
            className={c.id === tab ? "is-selected" : ""}
            onClick={() => setTab(c.id)}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="emoji-grid" role="tabpanel">
        {category.emojis.map((e, i) => (
          <button key={`${e}-${i}`} type="button" className="emoji-cell" onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
