"use client";

import { useState } from "react";
import NotesManager from "./NotesManager";

const TABS = [
  { id: "config", label: "کانفیگ‌ها", hint: "متن کانفیگ‌ها (v2ray، سرور، متغیرهای محیطی و ...) را نگه دارید و با یک کلیک کپی کنید. به‌طور پیش‌فرض فقط خودتان می‌بینید." },
  { id: "proxy", label: "پروکسی‌های اشتراکی", hint: "پروکسی‌هایی را که می‌خواهید با تیم به اشتراک بگذارید اینجا بگذارید؛ همکاران با یک کلیک کپی می‌کنند. به‌طور پیش‌فرض برای همه‌ی اعضا قابل مشاهده است." },
];

export default function ConfigsTabs({ configs, proxies, projects }) {
  const [tab, setTab] = useState("config");
  const current = TABS.find((t) => t.id === tab);
  return (
    <>
      <div className="filter-tabs" role="tablist" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="field-hint" style={{ marginBottom: 14 }}>{current.hint}</p>
      <NotesManager key={tab} kind={tab} initialNotes={tab === "config" ? configs : proxies} projects={projects} />
    </>
  );
}
