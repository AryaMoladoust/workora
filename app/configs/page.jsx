import { requireAuth } from "../../lib/require-auth";
import { memberProjects, queryNotes } from "../../lib/notes";
import NotesManager from "../../components/notes/NotesManager";

export const dynamic = "force-dynamic";

export default async function ConfigsPage() {
  const current = await requireAuth();
  const [notes, projects] = await Promise.all([queryNotes(current, { kind: "config" }), memberProjects(current)]);

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Configs</span>
          <h1>کانفیگ‌ها</h1>
          <p>متن کانفیگ‌ها (v2ray، سرور، متغیرهای محیطی و ...) را نگه دارید و با یک کلیک کپی کنید. به‌طور پیش‌فرض فقط خودتان می‌بینید.</p>
        </div>
      </div>
      <NotesManager kind="config" initialNotes={notes} projects={projects.map((p) => ({ id: String(p._id), name: p.name }))} />
    </div>
  );
}
