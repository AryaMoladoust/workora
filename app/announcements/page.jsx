import { requireAuth } from "../../lib/require-auth";
import { connectToDatabase } from "../../lib/db";
import { canPostAnnouncements, serializeAnnouncement } from "../../lib/announcements";
import AnnouncementsManager from "../../components/announcements/AnnouncementsManager";
import Announcement from "../../database/models/Announcement";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const current = await requireAuth();
  await connectToDatabase();
  const items = await Announcement.find({ workspaceId: current.workspace.id }).sort({ pinned: -1, createdAt: -1 }).limit(100).lean();

  return (
    <div className="page-shell narrow-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Announcements</span>
          <h1>اطلاعیه‌ها</h1>
          <p>اطلاع‌رسانی رسمی به کل تیم.</p>
        </div>
      </div>
      <AnnouncementsManager initialItems={items.map((a) => serializeAnnouncement(a, current))} canPost={canPostAnnouncements(current)} />
    </div>
  );
}
