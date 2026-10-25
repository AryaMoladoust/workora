import Link from "next/link";
import { hueFromString } from "../../lib/format";

// Avatar: the profile photo when there is one, otherwise the first letter of the name; green dot when online.
// kind="project" / "group" gives group chats a rounded-square shape. With `href` it links to a profile.
export default function ChatAvatar({ id, name, kind = "direct", size = "md", online = false, src = null, href = null }) {
  const letter = Array.from(String(name || "").trim())[0] || "؟";
  const body = (
    <span
      className={`cav cav-${size}${kind === "project" || kind === "group" ? " cav-group" : ""}`}
      style={{ "--h": hueFromString(String(id || name)) }}
      title={name}
    >
      {src ? <img className="cav-img" src={src} alt="" loading="lazy" decoding="async" /> : <span className="cav-letter">{letter}</span>}
      {online && <span className="cav-dot" role="img" aria-label="آنلاین" />}
    </span>
  );
  return href ? <Link href={href} className="cav-link" aria-label={`پروفایل ${name}`} onClick={(e) => e.stopPropagation()}>{body}</Link> : body;
}
