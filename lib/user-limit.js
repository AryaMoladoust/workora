import { NextResponse } from "next/server";
import { hit } from "./rate-limit";

// Per-user limits for everything that writes data (signed-in users only; login / sign-up have their own IP limits).
// Every rule is [max requests, window in seconds]; ALL rules of an action are checked and the strictest one answers.
// Limits are generous for normal use (a person typing, dragging task cards …) and only stop floods and scripts.
export const LIMITS = {
  write: [[120, 60]], // default for actions that are not listed

  "chat:send": [[30, 60], [600, 3600]], // messages (also what produces push notifications)
  "chat:edit": [[40, 60]],
  "chat:react": [[60, 60]],
  "chat:pin": [[30, 60]],
  "chat:search": [[20, 60]],
  "chat:group": [[10, 3600]], // creating groups
  "chat:manage": [[40, 600]], // rename / add / remove / leave / delete / mute
  "chat:open": [[40, 600]],

  avatar: [[12, 600]], // photo upload
  profile: [[40, 600]],
  "project:create": [[20, 3600]],
  project: [[60, 600]],
  "task:create": [[60, 60], [600, 3600]],
  task: [[120, 60]], // moving cards between columns patches a lot
  comment: [[30, 60]],
  note: [[60, 60]],
  announce: [[20, 600]],
  member: [[40, 600]],
  push: [[30, 600]],
};

function wait(seconds) {
  return seconds < 90 ? `${seconds.toLocaleString("fa-IR")} ثانیه` : `${Math.ceil(seconds / 60).toLocaleString("fa-IR")} دقیقه`;
}

/**
 * Counts one request of `action` for the signed-in user.
 * Returns null when it is fine, or a ready 429 response to return from the route:
 *   const limited = await limitUser(current, "chat:send");
 *   if (limited) return limited;
 * If the counter itself fails (database hiccup) the request is allowed: limiting must never take the app down.
 */
export async function limitUser(current, action) {
  const rules = LIMITS[action] || LIMITS.write;
  try {
    const results = await Promise.all(rules.map(([max, windowSec], i) => hit(`u:${action}:${i}:${current.user.id}`, { max, windowSec })));
    const blocked = results.filter((r) => r.limited);
    if (!blocked.length) return null;
    const retryAfterSec = Math.max(...blocked.map((r) => r.retryAfterSec));
    return NextResponse.json(
      { error: `تعداد درخواست‌ها زیاد است؛ ${wait(retryAfterSec)} بعد دوباره تلاش کنید.`, retryAfterSec },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  } catch (error) {
    console.error("USER_LIMIT_ERROR", error);
    return null;
  }
}
