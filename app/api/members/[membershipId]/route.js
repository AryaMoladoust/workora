import mongoose from "mongoose";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { hasPermission, isOwner, sanitizePermissions } from "../../../../lib/permissions";
import { serializeMember } from "../../../../lib/members";
import { logActivity } from "../../../../lib/activity";
import { validateName, validatePassword } from "../../../../lib/validation";
import User from "../../../../database/models/User";
import Membership from "../../../../database/models/Membership";
import Project from "../../../../database/models/Project";
import Task from "../../../../database/models/Task";
import Note from "../../../../database/models/Note";
import Notification from "../../../../database/models/Notification";
import PushSubscription from "../../../../database/models/PushSubscription";
import Conversation from "../../../../database/models/Conversation";
import ConversationRead from "../../../../database/models/ConversationRead";
import ChatMessage from "../../../../database/models/ChatMessage";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  if (!hasPermission(current, "members.manage")) {
    return NextResponse.json({ error: "اجازه ویرایش اعضا ندارید." }, { status: 403 });
  }
  if (!mongoose.isValidObjectId(params.membershipId)) {
    return NextResponse.json({ error: "شناسه نامعتبر است." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const membership = await Membership.findOne({ _id: params.membershipId, workspaceId: current.workspace.id });
    if (!membership) return NextResponse.json({ error: "عضو پیدا نشد." }, { status: 404 });

    if (membership.status === "pending") {
      return NextResponse.json({ error: "این درخواست ثبت‌نام است؛ ابتدا آن را تایید یا رد کنید." }, { status: 400 });
    }

    const user = await User.findById(membership.userId);
    if (!user) return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });

    const targetIsOwner = membership.role === "owner";
    const targetIsSelf = String(membership.userId) === current.user.id;
    const actorIsOwner = isOwner(current);

    // Non-owner managers cannot touch other managers.
    if (!actorIsOwner && !targetIsSelf && (targetIsOwner || (membership.permissions || []).includes("members.manage"))) {
      return NextResponse.json({ error: "اجازه ویرایش این عضو را ندارید." }, { status: 403 });
    }

    const body = await request.json();
    const userUpdate = {};
    const membershipUpdate = {};

    if (body.firstName !== undefined || body.lastName !== undefined) {
      const firstName = String(body.firstName ?? user.firstName).trim();
      const lastName = String(body.lastName ?? user.lastName).trim();
      const error = validateName(firstName, "نام") || validateName(lastName, "نام خانوادگی");
      if (error) return NextResponse.json({ error }, { status: 400 });
      userUpdate.firstName = firstName;
      userUpdate.lastName = lastName;
    }

    if (body.phone !== undefined) userUpdate.phone = String(body.phone || "").trim().slice(0, 30) || null;

    if (body.password) {
      const password = String(body.password);
      if (targetIsOwner && !targetIsSelf) {
        return NextResponse.json({ error: "رمز عبور مالک را فقط خودش می‌تواند تغییر دهد." }, { status: 403 });
      }
      const error = validatePassword(password);
      if (error) return NextResponse.json({ error }, { status: 400 });
      userUpdate.passwordHash = await bcrypt.hash(password, 12);
    }

    if (body.permissions !== undefined) {
      if (targetIsOwner) {
        return NextResponse.json({ error: "دسترسی‌های مالک قابل تغییر نیست." }, { status: 400 });
      }
      let next = sanitizePermissions(body.permissions);
      if (!actorIsOwner) {
        const previous = membership.permissions || [];
        // may only add permissions they hold; may keep or remove existing ones
        next = next.filter((p) => previous.includes(p) || hasPermission(current, p));
      }
      membershipUpdate.permissions = next;
    }

    if (body.isActive !== undefined) {
      const isActive = Boolean(body.isActive);
      if (!isActive && targetIsOwner) {
        return NextResponse.json({ error: "مالک را نمی‌توان غیرفعال کرد." }, { status: 400 });
      }
      if (!isActive && targetIsSelf) {
        return NextResponse.json({ error: "نمی‌توانید حساب خودتان را غیرفعال کنید." }, { status: 400 });
      }
      membershipUpdate.isActive = isActive;
    }

    if (Object.keys(userUpdate).length) await User.updateOne({ _id: user._id }, { $set: userUpdate });
    if (Object.keys(membershipUpdate).length) await Membership.updateOne({ _id: membership._id }, { $set: membershipUpdate });

    const memberName = `${userUpdate.firstName ?? user.firstName} ${userUpdate.lastName ?? user.lastName}`;
    const base = { entityType: "member", entityId: user._id, entityTitle: memberName };
    if (membershipUpdate.permissions) {
      const before = [...(membership.permissions || [])].sort().join(",");
      if (before !== [...membershipUpdate.permissions].sort().join(",")) {
        await logActivity(current, { ...base, type: "member.permissions_changed" });
      }
    }
    if (membershipUpdate.isActive !== undefined && membershipUpdate.isActive !== membership.isActive) {
      await logActivity(current, { ...base, type: membershipUpdate.isActive ? "member.activated" : "member.deactivated" });
    }

    const [freshMembership, freshUser] = await Promise.all([
      Membership.findById(membership._id).lean(),
      User.findById(user._id).lean(),
    ]);
    return NextResponse.json({ member: serializeMember(freshMembership, freshUser) });
  } catch (error) {
    console.error("MEMBER_UPDATE_ERROR", error);
    return NextResponse.json({ error: "ویرایش عضو انجام نشد." }, { status: 500 });
  }
}

// Permanently removes a member from the workspace (unlike "deactivate", this cannot be undone).
// Their comments, chat messages and tasks they created stay and show as "deleted user".
export async function DELETE(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  if (!hasPermission(current, "members.manage")) {
    return NextResponse.json({ error: "اجازه حذف عضو ندارید." }, { status: 403 });
  }
  if (!mongoose.isValidObjectId(params.membershipId)) {
    return NextResponse.json({ error: "شناسه نامعتبر است." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const workspaceId = current.workspace.id;
    const membership = await Membership.findOne({ _id: params.membershipId, workspaceId });
    if (!membership) return NextResponse.json({ error: "عضو پیدا نشد." }, { status: 404 });
    if (membership.status === "pending") {
      return NextResponse.json({ error: "این یک درخواست ثبت‌نام است؛ از بخش «درخواست‌های ثبت‌نام» رد کنید." }, { status: 400 });
    }
    if (membership.role === "owner") {
      return NextResponse.json({ error: "مالک را نمی‌توان حذف کرد." }, { status: 400 });
    }
    if (String(membership.userId) === current.user.id) {
      return NextResponse.json({ error: "نمی‌توانید خودتان را حذف کنید." }, { status: 400 });
    }
    // Non-owner managers cannot remove other managers.
    if (!isOwner(current) && (membership.permissions || []).includes("members.manage")) {
      return NextResponse.json({ error: "اجازه حذف این عضو را ندارید." }, { status: 403 });
    }

    const userId = membership.userId;
    const user = await User.findById(userId).select("firstName lastName email").lean();
    const name = user ? `${user.firstName} ${user.lastName}`.trim() : "کاربر";

    // 1) access: out of projects, tasks lose their assignee
    await Project.updateMany({ workspaceId, memberIds: userId }, { $pull: { memberIds: userId } });
    await Task.updateMany({ workspaceId, assigneeId: userId }, { $set: { assigneeId: null } });

    // 2) personal data: private notes, notifications, push devices, read markers, direct chats
    await Note.deleteMany({ workspaceId, ownerId: userId, scope: "private" });
    await Notification.deleteMany({ workspaceId, userId });
    await PushSubscription.deleteMany({ workspaceId, userId });
    const direct = await Conversation.find({ workspaceId, type: "direct", participantIds: userId }).select("_id").lean();
    const directIds = direct.map((c) => c._id);
    if (directIds.length) {
      await ChatMessage.deleteMany({ conversationId: { $in: directIds } });
      await ConversationRead.deleteMany({ conversationId: { $in: directIds } });
      await Conversation.deleteMany({ _id: { $in: directIds } });
    }
    await ConversationRead.deleteMany({ userId });

    // 3) the membership, and the account itself when it belongs to no other workspace (frees the e-mail)
    await Membership.deleteOne({ _id: membership._id });
    if (!(await Membership.exists({ userId }))) await User.deleteOne({ _id: userId });

    await logActivity(current, { type: "member.removed", entityType: "member", entityId: userId, entityTitle: name, meta: { email: user?.email || "" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("MEMBER_DELETE_ERROR", error);
    return NextResponse.json({ error: "حذف عضو انجام نشد." }, { status: 500 });
  }
}
