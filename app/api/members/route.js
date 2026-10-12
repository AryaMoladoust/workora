import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { hasPermission, isOwner, sanitizePermissions } from "../../../lib/permissions";
import { listWorkspaceMembers, serializeMember } from "../../../lib/members";
import { logActivity } from "../../../lib/activity";
import { isValidEmail, normalizeEmail, validateName, validatePassword } from "../../../lib/validation";
import User from "../../../database/models/User";
import Membership from "../../../database/models/Membership";

export const runtime = "nodejs";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const canManage = hasPermission(current, "members.manage");
  const members = await listWorkspaceMembers(current.workspace.id, { includeInactive: canManage });
  // Only managers see permissions, phone numbers and last login.
  return NextResponse.json({
    members: members.map((m) => (canManage ? m : { ...m, permissions: [], phone: "", lastLoginAt: null })),
  });
}

export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  if (!hasPermission(current, "members.manage")) {
    return NextResponse.json({ error: "اجازه افزودن عضو ندارید." }, { status: 403 });
  }

  let createdUserId = null;
  try {
    const body = await request.json();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const phone = String(body.phone || "").trim().slice(0, 30);

    const error =
      validateName(firstName, "نام") ||
      validateName(lastName, "نام خانوادگی") ||
      validatePassword(password) ||
      (!isValidEmail(email) || email.length > 160 ? "ایمیل معتبر نیست." : null);
    if (error) return NextResponse.json({ error }, { status: 400 });

    // A manager can only hand out permissions they hold themselves.
    let permissions = sanitizePermissions(body.permissions);
    if (!isOwner(current)) permissions = permissions.filter((p) => hasPermission(current, p));

    await connectToDatabase();
    if (await User.exists({ email })) {
      return NextResponse.json({ error: "کاربری با این ایمیل قبلاً ثبت شده است." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ firstName, lastName, email, passwordHash, phone: phone || null });
    createdUserId = user._id;

    const membership = await Membership.create({
      workspaceId: current.workspace.id,
      userId: user._id,
      role: "member",
      permissions,
    });

    await logActivity(current, { type: "member.created", entityType: "member", entityId: user._id, entityTitle: `${firstName} ${lastName}` });

    return NextResponse.json({ member: serializeMember(membership.toObject(), user.toObject()) }, { status: 201 });
  } catch (err) {
    if (createdUserId) await User.deleteOne({ _id: createdUserId }).catch(() => {});
    if (err?.code === 11000) {
      return NextResponse.json({ error: "کاربری با این ایمیل قبلاً ثبت شده است." }, { status: 409 });
    }
    console.error("MEMBER_CREATE_ERROR", err);
    return NextResponse.json({ error: "افزودن عضو انجام نشد." }, { status: 500 });
  }
}
