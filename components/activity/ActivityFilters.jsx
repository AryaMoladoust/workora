"use client";

import { useRouter } from "next/navigation";
import { GROUP_LABELS } from "../../lib/activity-text";

const RANGE_LABELS = { "24h": "۲۴ ساعت اخیر", "7d": "۷ روز اخیر", "30d": "۳۰ روز اخیر" };

// basePath: "/activity" or "/projects/<id>/activity". Pushes filters into the query string.
export default function ActivityFilters({ basePath, current, projects = [], actors = [] }) {
  const router = useRouter();

  function update(key, value) {
    const next = { ...current, [key]: value, page: "" };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const active = Object.entries(current).some(([k, v]) => k !== "page" && v);

  return (
    <div className="toolbar">
      {projects.length > 0 && (
        <select className="tw-select" value={current.project || ""} onChange={(e) => update("project", e.target.value)} aria-label="پروژه">
          <option value="">همه پروژه‌ها</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <select className="tw-select" value={current.actor || ""} onChange={(e) => update("actor", e.target.value)} aria-label="کاربر">
        <option value="">همه کاربران</option>
        {actors.map((a) => <option key={a.userId} value={a.userId}>{a.firstName} {a.lastName}</option>)}
      </select>
      <select className="tw-select" value={current.group || ""} onChange={(e) => update("group", e.target.value)} aria-label="نوع رویداد">
        <option value="">همه رویدادها</option>
        {Object.entries(GROUP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select className="tw-select" value={current.range || ""} onChange={(e) => update("range", e.target.value)} aria-label="بازه زمانی">
        <option value="">همه زمان‌ها</option>
        {Object.entries(RANGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {active && (
        <button type="button" className="link-button" onClick={() => router.push(basePath)}>پاک کردن فیلترها</button>
      )}
    </div>
  );
}
