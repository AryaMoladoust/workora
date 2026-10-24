import Link from "next/link";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import CompletenessRing from "./CompletenessRing";
import { fa, hueFromString } from "../../lib/format";

// Dashboard section dedicated to the user's own profile: a big photo tile (name on the photo) next to the completeness card.
export default function ProfileCard({ user, summary, role }) {
  const { profile, completeness } = summary;
  const full = completeness.percent >= 100;
  const name = `${user.firstName} ${user.lastName}`.trim();
  const hue = hueFromString(user.id);
  return (
    <section className="pf-dash" aria-label="پروفایل من">
      <Link href="/profile" className="pf-dash-photo" style={{ "--h": hue }} aria-label="مشاهده پروفایل">
        {summary.avatarUrl ? <img src={summary.avatarUrl} alt="" /> : <Avatar user={{ ...user, avatarUrl: null }} size="xl" className="pf-dash-initials" />}
        <span className="pf-dash-shade" />
        <span className="pf-dash-caption">
          <span>
            <strong>{name}</strong>
            <small>{profile.headline || "عنوان شغلی‌تان را اضافه کنید"}</small>
          </span>
          <span className="pf-dash-pill">{role === "owner" ? "مالک" : "عضو"}</span>
        </span>
      </Link>

      <div className="pf-dash-panel">
        <div className="pf-dash-head">
          <span className="pf-dash-eyebrow">پروفایل من</span>
          <Link href="/profile" className="card-link">{full ? "مشاهده" : "تکمیل پروفایل"}<Icon name="arrowLeft" size={15} /></Link>
        </div>

        <div className="pf-dash-progress">
          <CompletenessRing percent={completeness.percent} size={92} />
          <div>
            <strong>{full ? "پروفایل شما کامل است 🎉" : `${fa(completeness.percent)}٪ تکمیل شده`}</strong>
            <p>{full ? "همکاران می‌توانند مهارت‌ها و سوابق شما را ببینند." : "با تکمیل پروفایل، همکاران شما را بهتر می‌شناسند."}</p>
          </div>
        </div>

        {!full && (
          <ul className="pf-dash-todo">
            {completeness.missing.slice(0, 4).map((s) => (
              <li key={s.id}><Link href={s.href}><Icon name="plus" size={13} />{s.label}</Link></li>
            ))}
          </ul>
        )}

        <div className="pf-dash-skills">
          {profile.skills.slice(0, 6).map((s) => <span className="pf-chip" key={s}>{s}</span>)}
          {profile.skills.length === 0 && <span className="pf-empty">هنوز مهارتی اضافه نکرده‌اید.</span>}
        </div>
      </div>
    </section>
  );
}
