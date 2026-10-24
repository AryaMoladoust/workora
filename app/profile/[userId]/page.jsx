import { notFound, redirect } from "next/navigation";
import { requireAuth } from "../../../lib/require-auth";
import { getProfilePage } from "../../../lib/profile-data";
import ProfileView from "../../../components/profile/ProfileView";

export const dynamic = "force-dynamic";

// Profile of another member of the workspace.
export default async function MemberProfilePage({ params }) {
  params = await params;
  const current = await requireAuth();
  if (params.userId === current.user.id) redirect("/profile");
  const data = await getProfilePage(current, params.userId);
  if (!data) notFound();
  return <div className="page-shell page-shell-wide"><ProfileView data={data} /></div>;
}
