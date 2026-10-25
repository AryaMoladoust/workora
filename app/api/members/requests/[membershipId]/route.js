import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";
import { hasPermission } from "../../../../../lib/permissions";
import { logActivity } from "../../../../../lib/activity";
import { mailConfigured, sendApprovalEmail } from "../../../../../lib/mail";
import User from "../../../../../database/models/User";
import Membership from "../../../../../database/models/Membership";
import { limitUser } from "../../../../../lib/user-limit";

export const runtime = "nodejs";

// PATCH { action: "approve" | "reject" } on a pending sign-up request
export async function PATCH(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const limited = await limitUser(current, "member");
  if (limited) return limited;
  if (!hasPermission(current, "members.manage")) {
    return NextResponse.json({ error: "اجازه بررسی درخواست‌ها را ندارید." }, { status: 403 });
  }
  if (!mongoose.isValidObjectId(params.membershipId)) {
    return NextResponse.json({ error: "شناسه نامعتبر است." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "عملیات نامعتبر است." }, { status: 400 });
    }

    await connectToDatabase();
    const membership = await Membership.findOne({ _id: params.membershipId, workspaceId: current.workspace.id, status: "pending" });
    if (!membership) return NextResponse.json({ error: "درخواست پیدا نشد (شاید قبلاً بررسی شده است)." }, { status: 404 });

    const user = await User.findById(membership.userId).select("firstName lastName email").lean();
    const name = user ? `${user.firstName} ${user.lastName}`.trim() : "کاربر";
    const base = { entityType: "member", entityId: membership.userId, entityTitle: name, meta: { email: user?.email || "" } };

    if (action === "approve") {
      await Membership.updateOne(
        { _id: membership._id, status: "pending" },
        { $set: { isActive: true, status: "active", joinedAt: new Date() } }
      );
      await logActivity(current, { ...base, type: "member.approved" });

      // tell the person by e-mail (best effort – the approval itself never fails because of it)
      let email = "not_configured";
      if (user?.email && mailConfigured()) {
        try {
          const origin = process.env.APP_URL || new URL(request.url).origin;
          await sendApprovalEmail({
            to: user.email,
            name: user.firstName,
            loginUrl: `${origin.replace(/\/$/, "")}/login`,
          });
          email = "sent";
        } catch (mailError) {
          console.error("APPROVAL_MAIL_ERROR", mailError);
          email = "failed";
        }
      }
      return NextResponse.json({ ok: true, status: "approved", email });
    }

    // reject: remove the request (and the account, if it has no other membership) so the person can apply again later
    await Membership.deleteOne({ _id: membership._id });
    if (!(await Membership.exists({ userId: membership.userId }))) await User.deleteOne({ _id: membership.userId });
    await logActivity(current, { ...base, type: "member.rejected" });
    return NextResponse.json({ ok: true, status: "rejected" });
  } catch (error) {
    console.error("SIGNUP_REVIEW_ERROR", error);
    return NextResponse.json({ error: "انجام نشد." }, { status: 500 });
  }
}
