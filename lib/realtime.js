// Bridge between the Next.js route handlers and the WebSocket server started by server.js.
// Both live in the same Node process, so they share the hub through a global symbol.
// When the app runs without server.js (plain `next dev`) publish() silently does nothing and
// the client falls back to polling.
const KEY = Symbol.for("workora.realtime");

export function publish(userIds, event) {
  const hub = globalThis[KEY];
  if (!hub) return;
  try {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (ids.length) hub.publish(ids, event);
  } catch (error) {
    console.error("REALTIME_PUBLISH_ERROR", error);
  }
}

export function realtimeAvailable() {
  return Boolean(globalThis[KEY]);
}
