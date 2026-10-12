import { notFound } from "next/navigation";
import { requireAuth } from "../../../../lib/require-auth";
import { getProjectForPage } from "../../../../lib/project-access";
import { listWorkspaceMembers } from "../../../../lib/members";
import { getActivities } from "../../../../lib/activity";
import ActivityFeed from "../../../../components/activity/ActivityFeed";
import ActivityFilters from "../../../../components/activity/ActivityFilters";
import Pager from "../../../../components/activity/Pager";

export const dynamic = "force-dynamic";

const str = (v) => (typeof v === "string" ? v : "");

export default async function ProjectActivityPage({ params, searchParams }) {
  params = await params;
  searchParams = await searchParams;
  const current = await requireAuth();
  const project = await getProjectForPage(current, params.projectId);
  if (!project) notFound();

  const query = { actor: str(searchParams?.actor), group: str(searchParams?.group), range: str(searchParams?.range) };
  const [members, data] = await Promise.all([
    listWorkspaceMembers(current.workspace.id, { includeInactive: true }),
    getActivities(current, { projectId: String(project._id), actorId: query.actor, group: query.group, range: query.range, page: str(searchParams?.page) }),
  ]);
  const basePath = `/projects/${project._id}/activity`;

  return (
    <>
      <ActivityFilters
        basePath={basePath}
        current={query}
        actors={members.filter((m) => project.memberIds.map(String).includes(m.userId)).map(({ userId, firstName, lastName }) => ({ userId, firstName, lastName }))}
      />
      <section className="card">
        <ActivityFeed items={data.items} showProject={false} now={new Date()} emptyText="هنوز فعالیتی در این پروژه ثبت نشده است." />
      </section>
      <Pager basePath={basePath} query={query} page={data.page} pages={data.pages} />
    </>
  );
}
