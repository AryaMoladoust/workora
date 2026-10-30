import { requireAuth } from "../../lib/require-auth";
import { connectToDatabase } from "../../lib/db";
import { hasPermission } from "../../lib/permissions";
import User from "../../database/models/User";
import ProfileForm from "../../components/settings/ProfileForm";
import PasswordForm from "../../components/settings/PasswordForm";
import NotificationsCard from "../../components/settings/NotificationsCard";
import WorkspaceForm from "../../components/settings/WorkspaceForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const current = await requireAuth();
  await connectToDatabase();
  const user = await User.findById(current.user.id).select("phone hideLastSeen").lean();

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Settings</span>
          <h1>تنظیمات</h1>
          <p>پروفایل، رمز عبور و اعلان‌های شما{hasPermission(current, "settings.manage") ? " و تنظیمات فضای کاری" : ""}.</p>
        </div>
      </div>

      <div className="settings-grid">
        <ProfileForm initial={{ firstName: current.user.firstName, lastName: current.user.lastName, email: current.user.email, phone: user?.phone || "", hideLastSeen: Boolean(user?.hideLastSeen) }} />
        <PasswordForm />
        <NotificationsCard />
        {hasPermission(current, "settings.manage") && <WorkspaceForm initialName={current.workspace.name} />}
      </div>
    </div>
  );
}
