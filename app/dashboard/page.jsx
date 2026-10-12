import { requireAuth } from "../../lib/require-auth";
import { hasPermission } from "../../lib/permissions";
import { getDashboardData } from "../../lib/dashboard-data";
import DashboardView from "../../components/dashboard/DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const current = await requireAuth();
  const data = await getDashboardData(current);

  return (
    <DashboardView
      firstName={current.user.firstName}
      data={data}
      canManageProjects={hasPermission(current, "projects.manage")}
    />
  );
}
