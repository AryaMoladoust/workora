import Link from "next/link";
import Icon from "../ui/Icon";
import { fa, greeting, longDate } from "../../lib/format";
import {
  Card,
  CardLink,
  StatCard,
  UpcomingTasks,
  StatusDonut,
  ProjectProgress,
  WeeklyBars,
  TeamCard,
} from "./widgets";
import ProfileCard from "../profile/ProfileCard";
import ActivityFeed from "../activity/ActivityFeed";

function heroSummary(me) {
  if (me.overdue > 0) {
    return `${fa(me.open)} وظیفه باز دارید که ${fa(me.overdue)} مورد از مهلت گذشته است.`;
  }
  if (me.open > 0) {
    return `${fa(me.open)} وظیفه باز دارید و هیچ‌کدام عقب‌افتاده نیست. عالیه!`;
  }
  return "الان وظیفه بازی ندارید. می‌توانید یک پروژه یا وظیفه جدید تعریف کنید.";
}

export default function DashboardView({ user, role, firstName, data, profileSummary, canManageProjects }) {
  const now = new Date(data.now);

  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero-text">
          <span className="hero-date"><Icon name="calendar" size={15} />{longDate(now)}</span>
          <h1>{greeting(now)}، {firstName} <span aria-hidden="true">👋</span></h1>
          <p>{heroSummary(data.me)}</p>
        </div>
        <div className="hero-actions">
          <Link href="/tasks" className="hero-button hero-button-solid">
            <Icon name="tasks" size={18} />
            وظایف من
          </Link>
          {canManageProjects && (
            <Link href="/projects/new" className="hero-button hero-button-ghost">
              <Icon name="plus" size={18} />
              پروژه جدید
            </Link>
          )}
        </div>
      </section>

      {data.announcement && (
        <Link href="/announcements" className="announce-banner">
          <span className="announce-icon"><Icon name="megaphone" size={20} /></span>
          <span className="announce-banner-text">
            <strong>{data.announcement.title}</strong>
            <small>{data.announcement.body}</small>
          </span>
          <span className="announce-banner-meta">{data.announcement.pinned ? "سنجاق‌شده" : data.announcement.relative}</span>
        </Link>
      )}

      {user && profileSummary && <ProfileCard user={user} summary={profileSummary} role={role} />}

      <section className="stat-grid" aria-label="خلاصه وضعیت">
        <StatCard icon="tasks" label="وظایف باز من" value={data.me.open} hint={`${fa(data.me.inProgress)} مورد در حال انجام`} />
        <StatCard icon="users" label="واگذارشده به دیگران" value={data.me.delegatedOpen} hint="وظایف بازی که شما ساخته‌اید" tone="info" />
        <StatCard icon="alert" label="عقب‌افتاده" value={data.me.overdue} hint={data.me.overdue ? "نیازمند توجه" : "همه‌چیز طبق برنامه"} tone={data.me.overdue ? "danger" : "ok"} />
        <StatCard icon="folder" label="پروژه‌های فعال" value={data.projectCounts.active} hint={`${fa(data.projectCounts.total)} پروژه در کل`} tone="violet" />
      </section>

      <section className="dash-grid">
        <Card className="span-7" title="وظایف پیش‌رو من" icon="clock" action={<CardLink href="/tasks">همه وظایف</CardLink>}>
          <UpcomingTasks tasks={data.upcomingTasks} now={data.now} />
        </Card>

        <Card className="span-5" title="وضعیت وظایف تیم" icon="layers">
          <StatusDonut counts={data.workspace.counts} total={data.workspace.total} percentDone={data.workspace.percentDone} />
        </Card>

        <Card className="span-7" title="پیشرفت پروژه‌ها" icon="folder" action={<CardLink href="/projects">همه پروژه‌ها</CardLink>}>
          <ProjectProgress projects={data.projects} />
        </Card>

        <Card className="span-5" title="وظایف ساخته‌شده در ۷ روز اخیر" icon="trend">
          <WeeklyBars week={data.week} />
        </Card>

        <Card className="span-5" title="تیم" icon="users" action={<CardLink href="/members">{fa(data.memberCount)} عضو</CardLink>}>
          <TeamCard team={data.team} memberCount={data.memberCount} />
        </Card>

        <Card className="span-7" title="آخرین فعالیت‌ها" icon="activity" action={<CardLink href="/activity">مشاهده لاگ</CardLink>}>
          <ActivityFeed items={data.activities} grouped={false} now={now} />
        </Card>
      </section>
    </div>
  );
}
