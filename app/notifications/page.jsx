import Link from "next/link";
import { requireAuth } from "../../lib/require-auth";
import { listNotifications } from "../../lib/notifications";
import NotificationList from "../../components/notifications/NotificationList";
import Pager from "../../components/activity/Pager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function NotificationsPage({ searchParams }) {
  searchParams = await searchParams;
  const current = await requireAuth();
  const unreadOnly = searchParams?.filter === "unread";
  const page = Math.max(1, Number.parseInt(searchParams?.page, 10) || 1);

  const data = await listNotifications(current, { unreadOnly, limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="page-shell narrow-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Notifications</span>
          <h1>اعلان‌ها</h1>
          <p>هر اتفاقی که به شما مربوط است.</p>
        </div>
      </div>

      <div className="scope-tabs filter-tabs">
        <Link href="/notifications" className={!unreadOnly ? "is-active" : ""}>همه</Link>
        <Link href="/notifications?filter=unread" className={unreadOnly ? "is-active" : ""}>
          خوانده‌نشده
          {data.unread > 0 && <span>{data.unread.toLocaleString("fa-IR")}</span>}
        </Link>
      </div>

      <NotificationList key={`${unreadOnly}-${page}`} initialItems={data.items} unread={data.unread} />
      <Pager basePath="/notifications" query={{ filter: unreadOnly ? "unread" : "" }} page={page} pages={pages} />
    </div>
  );
}
