import { requireAuth } from "../../lib/require-auth";
import { memberProjects, queryNotes } from "../../lib/notes";
import NotesManager from "../../components/notes/NotesManager";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const current = await requireAuth();
  const [notes, projects] = await Promise.all([queryNotes(current, { kind: "note" }), memberProjects(current)]);

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Notes</span>
          <h1>یادداشت‌ها</h1>
          <p>یادداشت شخصی بنویسید یا برای همه‌ی اعضا و یک پروژه به‌اشتراک بگذارید.</p>
        </div>
      </div>
      <NotesManager kind="note" initialNotes={notes} projects={projects.map((p) => ({ id: String(p._id), name: p.name }))} />
    </div>
  );
}
