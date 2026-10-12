import { requireAuth } from "../../lib/require-auth";
import { connectToDatabase } from "../../lib/db";
import { projectScope } from "../../lib/project-access";
import { listWorkspaceMembers } from "../../lib/members";
import { getActivities } from "../../lib/activity";
import { fa } from "../../lib/format";
import ActivityFeed from "../../components/activity/ActivityFeed";
import ActivityFilters from "../../components/activity/ActivityFilters";
import Pager from "../../components/activity/Pager";
import Project from "../../database/models/Project";

export const dynamic = "force-dynamic";

const str = (v) => (typeof v === "string" ? v : "");

export default async function ActivityPage({ searchParams }) {
  searchParams = await searchParams;
  const current = await requireAuth();
  const query = { project: str(searchParams?.project), actor: str(searchParams?.actor), group: str(searchParams?.group), range: str(searchParams?.range) };

  await connectToDatabase();
  const [projects, members, data] = await Promise.all([
    Project.find(projectScope(current)).sort({ name: 1 }).select("name").limit(300).lean(),
    listWorkspaceMembers(current.workspace.id, { includeInactive: true }),
    getActivities(current, { projectId: query.project, actorId: query.actor, group: query.group, range: query.range, page: str(searchParams?.page) }),
  ]);

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Activity</span>
          <h1>فعالیت‌ها</h1>
          <p>{fa(data.total)} رویداد ثبت شده</p>
        </div>
      </div>

      <ActivityFilters
        basePath="/activity"
        current={query}
        projects={projects.map((p) => ({ id: String(p._id), name: p.name }))}
        actors={members.map(({ userId, firstName, lastName }) => ({ userId, firstName, lastName }))}
      />

      <section className="card">
        <ActivityFeed items={data.items} now={new Date()} />
      </section>
      <Pager basePath="/activity" query={query} page={data.page} pages={data.pages} />
    </div>
  );
}
