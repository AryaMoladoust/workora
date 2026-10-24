import { requireAuth } from "../../lib/require-auth";
import { hasPermission } from "../../lib/permissions";
import { getDashboardData } from "../../lib/dashboard-data";
import { getMyProfileSummary } from "../../lib/profile-data";
import OnboardingWizard from "../../components/profile/OnboardingWizard";
import DashboardView from "../../components/dashboard/DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const current = await requireAuth();
  const [data, profileSummary] = await Promise.all([getDashboardData(current), getMyProfileSummary(current)]);

  return (
    <>
      <DashboardView
        user={current.user}
        role={current.membership.role}
        firstName={current.user.firstName}
        data={data}
        profileSummary={profileSummary}
        canManageProjects={hasPermission(current, "projects.manage")}
      />
      {/* first login: a friendly, fully skippable wizard that fills in the profile */}
      {!profileSummary.profile.onboarded && <OnboardingWizard user={{ ...current.user, avatarUrl: profileSummary.avatarUrl }} />}
    </>
  );
}
