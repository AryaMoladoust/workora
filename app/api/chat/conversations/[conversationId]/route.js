import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";
import { conversationAccess, isMutedFor, participantList, pinsOf, presenceOf, readsOf, setMuted } from "../../../../../lib/chat";
import User from "../../../../../database/models/User";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Conversation details for the open thread: participants (for @mentions and names), pinned messages,
// mute flag, read receipts and who is online / last seen.
export async function GET(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);

  await connectToDatabase();
  const [participants, pins, muted, reads] = await Promise.all([
    participantList(current, access),
    pinsOf(access.conversation._id),
    isMutedFor(access.conversation._id, current.user.id),
    readsOf(access.conversation._id, current.user.id),
  ]);

  const others = participants.filter((p) => p.id !== current.user.id);
  const users = others.length ? await User.find({ _id: { $in: others.map((p) => p.id) } }).select("lastSeenAt").lean() : [];
  const now = new Date();
  const presence = {};
  for (const u of users) presence[String(u._id)] = presenceOf(u, now);

  return NextResponse.json({ participants, pins, muted, reads, presence });
}

// Body: { muted: boolean } – silence / un-silence this conversation for the current user.
export async function PATCH(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);

  const body = await request.json().catch(() => ({}));
  if (typeof body.muted !== "boolean") return bad("درخواست نامعتبر است.");
  const muted = await setMuted(current, access.conversation._id, body.muted);
  return NextResponse.json({ ok: true, muted });
}
