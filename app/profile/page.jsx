import { requireAuth } from "../../lib/require-auth";
import { getProfilePage } from "../../lib/profile-data";
import ProfileView from "../../components/profile/ProfileView";

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const current = await requireAuth();
  const data = await getProfilePage(current, current.user.id);
  return <div className="page-shell page-shell-wide"><ProfileView data={data} /></div>;
}
