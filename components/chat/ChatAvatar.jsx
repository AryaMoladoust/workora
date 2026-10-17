import { hueFromString } from "../../lib/format";

// Avatar showing the first letter of the name, with a green dot when the person is online.
// kind="project" gives group chats a rounded-square shape.
export default function ChatAvatar({ id, name, kind = "direct", size = "md", online = false }) {
  const letter = Array.from(String(name || "").trim())[0] || "؟";
  return (
    <span
      className={`cav cav-${size}${kind === "project" ? " cav-group" : ""}`}
      style={{ "--h": hueFromString(String(id || name)) }}
      title={name}
    >
      <span className="cav-letter">{letter}</span>
      {online && <span className="cav-dot" role="img" aria-label="آنلاین" />}
    </span>
  );
}
