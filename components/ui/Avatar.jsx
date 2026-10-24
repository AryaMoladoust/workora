import { initials, hueFromString } from "../../lib/format";

// Profile photo when the user has one, otherwise the coloured initials. size: "sm" | "md" (default) | "lg" | "xl".
export default function Avatar({ user, size = "md", className = "" }) {
  const cls = `avatar${size === "md" ? "" : ` avatar-${size}`}${className ? ` ${className}` : ""}`;
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return (
    <span className={cls} style={{ "--h": hueFromString(String(user.id || name)) }} title={name || undefined}>
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" loading="lazy" decoding="async" /> : initials(user.firstName, user.lastName)}
    </span>
  );
}
