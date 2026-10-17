import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { touchPresence } from "../../../lib/chat";

export const runtime = "nodejs";

// Heartbeat from the open app (about once a minute): drives the green "online" dot and "last seen".
export async function POST() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  try {
    await touchPresence(current.user.id);
  } catch (error) {
    console.error("PRESENCE_ERROR", error);
  }
  return NextResponse.json({ ok: true });
}
