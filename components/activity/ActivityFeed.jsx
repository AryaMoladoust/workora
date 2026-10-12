import Link from "next/link";
import Icon from "../ui/Icon";
import NameAvatar from "../ui/NameAvatar";
import { describeActivity } from "../../lib/activity-text";
import { dayLabel } from "../../lib/format";

function Sentence({ item }) {
  const d = describeActivity(item);
  const title = d.title && item.link ? <Link href={item.link} className="feed-link">{d.title}</Link> : <strong>{d.title}</strong>;
  return (
    <p className="feed-text">
      <strong className="feed-actor">{item.actorName}</strong> {d.prefix}{title}{d.suffix}
    </p>
  );
}

function Item({ item, showProject }) {
  const d = describeActivity(item);
  return (
    <li className="feed-item">
      <span className="feed-avatar">
        <NameAvatar id={item.actorId} name={item.actorName} />
        <span className={`feed-badge tone-${d.tone}`}><Icon name={d.icon} size={11} strokeWidth={2.6} /></span>
      </span>
      <div className="feed-body">
        <Sentence item={item} />
        {item.type === "comment.created" && item.meta?.snippet && <blockquote className="feed-quote">{item.meta.snippet}</blockquote>}
        <small className="feed-meta">
          {item.timeText}
          {showProject && item.projectName && <> · {item.projectName}</>}
        </small>
      </div>
    </li>
  );
}

// grouped = timeline split by day; otherwise a flat compact list.
export default function ActivityFeed({ items, showProject = true, grouped = true, now = new Date(), emptyText = "هنوز فعالیتی ثبت نشده است." }) {
  if (!items.length) {
    return (
      <div className="empty-inline">
        <span className="empty-inline-icon"><Icon name="activity" size={22} /></span>
        <strong>{emptyText}</strong>
        <p>با ساخت و ویرایش پروژه‌ها و وظایف، فعالیت‌ها اینجا نمایش داده می‌شود.</p>
      </div>
    );
  }

  if (!grouped) {
    return <ul className="feed feed-compact">{items.map((item) => <Item key={item.id} item={item} showProject={showProject} />)}</ul>;
  }

  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.key === item.dayKey) last.items.push(item);
    else groups.push({ key: item.dayKey, items: [item] });
  }

  return (
    <div className="feed-groups">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="feed-day">{dayLabel(g.key, now)}</h3>
          <ul className="feed">{g.items.map((item) => <Item key={item.id} item={item} showProject={showProject} />)}</ul>
        </section>
      ))}
    </div>
  );
}
