import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";
import { clearDirectConversationForMe, conversationAccess, deleteGroupConversation, entryForConversation, leaveGroupConversation, isMutedFor, participantList, pinsOf, presenceOf, readsOf, setMuted, updateGroup } from "../../../../../lib/chat";
import { publish } from "../../../../../lib/realtime";
import User from "../../../../../database/models/User";
import { limitUser } from "../../../../../lib/user-limit";

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
    pinsOf(access.conversation._id, current.user.id),
    isMutedFor(access.conversation._id, current.user.id),
    readsOf(access.conversation._id, current.user.id),
  ]);

  const others = participants.filter((p) => p.id !== current.user.id);
  const users = others.length ? await User.find({ _id: { $in: others.map((p) => p.id) } }).select("lastSeenAt").lean() : [];
  const now = new Date();
  const presence = {};
  for (const u of users) presence[String(u._id)] = presenceOf(u, now);

  const ownerId = access.conversation.type === "group" && access.conversation.createdBy ? String(access.conversation.createdBy) : null;
  return NextResponse.json({ participants, pins, muted, reads, presence, ownerId });
}

// Body: { muted: boolean } – silence / un-silence this conversation for the current user.
export async function PATCH(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "chat:manage");
  if (limited) return limited;

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);

  const body = await request.json().catch(() => ({}));
  const convId = String(access.conversation._id);
  if (body.leave === true) {
    if (access.conversation.type !== "group") return bad("فقط از گروه‌های ساخته‌شده می‌توان خارج شد.");
    const result = await leaveGroupConversation(current, access.conversation);
    // the others see the member count / the new manager (or that the group is gone)
    publish((result.deleted ? result.previous : result.participants).filter((id) => id !== current.user.id), { type: "chat.group", conversationId: convId });
    return NextResponse.json({ ok: true, left: true });
  }
  // group management (manager only): rename, add / remove members, hand the group over
  if (body.name !== undefined || body.addMemberIds !== undefined || body.removeMemberId !== undefined || body.transferTo !== undefined) {
    if (access.conversation.type !== "group") return bad("فقط گروه‌های ساخته‌شده قابل مدیریت هستند.");
    const result = await updateGroup(current, access.conversation, body);
    if (result.error) return bad(result.error, result.status);
    const affected = [...new Set([...result.previous, ...result.participants])].filter((id) => id !== current.user.id);
    publish(affected, { type: "chat.group", conversationId: convId });
    const entry = await entryForConversation(current, result.conversation);
    return NextResponse.json({ ok: true, conversation: entry });
  }
  if (typeof body.muted !== "boolean") return bad("درخواست نامعتبر است.");
  const muted = await setMuted(current, access.conversation._id, body.muted);
  return NextResponse.json({ ok: true, muted });
}

// Delete a conversation:
//  - custom group: only its creator, for everybody (members are told so their list refreshes)
//  - direct chat: removes it for the caller only
// Project rooms belong to the project and cannot be deleted here.
export async function DELETE(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "chat:manage");
  if (limited) return limited;

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);
  const conv = access.conversation;

  if (conv.type === "group") {
    if (String(conv.createdBy) !== current.user.id) return bad("فقط سازنده‌ی گروه می‌تواند آن را حذف کند. می‌توانید از گروه خارج شوید.", 403);
    await deleteGroupConversation(conv);
    publish(access.participants.filter((id) => id !== current.user.id), { type: "chat.group", conversationId: String(conv._id) });
    return NextResponse.json({ ok: true, scope: "all" });
  }
  if (conv.type === "direct") {
    await clearDirectConversationForMe(current, conv);
    return NextResponse.json({ ok: true, scope: "me" });
  }
  return bad("چت پروژه را نمی‌توان از اینجا حذف کرد.", 400);
}
