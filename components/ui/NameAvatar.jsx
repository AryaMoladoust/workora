import { hueFromString, initials } from "../../lib/format";

// Avatar built from a full name string (used where only a denormalized name is stored).
export default function NameAvatar({ id, name, size = "md" }) {
  const [first = "", ...rest] = String(name || "").trim().split(/\s+/);
  return (
    <span className={`avatar avatar-${size}`} style={{ "--h": hueFromString(String(id || name)) }} title={name}>
      {initials(first, rest.join(" "))}
    </span>
  );
}
