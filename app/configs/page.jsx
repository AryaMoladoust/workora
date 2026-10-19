import { requireAuth } from "../../lib/require-auth";
import { memberProjects, queryNotes } from "../../lib/notes";
import ConfigsTabs from "../../components/notes/ConfigsTabs";

export const dynamic = "force-dynamic";

export default async function ConfigsPage() {
  const current = await requireAuth();
  const [configs, proxies, projects] = await Promise.all([
    queryNotes(current, { kind: "config" }),
    queryNotes(current, { kind: "proxy" }),
    memberProjects(current),
  ]);

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Configs</span>
          <h1>کانفیگ‌ها</h1>
          <p>کانفیگ‌های شخصی و پروکسی‌های اشتراکی تیم، یک‌جا.</p>
        </div>
      </div>
      <ConfigsTabs configs={configs} proxies={proxies} projects={projects.map((p) => ({ id: String(p._id), name: p.name }))} />
    </div>
  );
}
