import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { clientIp, hit } from "../../../../lib/rate-limit";
import { emailKey, emailMatch, normalizeEmail } from "../../../../lib/validation";
import { describeServerError } from "../../../../lib/errors";
import { logActivity, notify } from "../../../../lib/activity";
import { findPrimaryWorkspace, signupRequestsEnabled } from "../../../../lib/signup";
import { OTP_MAX_ATTEMPTS, codeMatches, normalizeCode } from "../../../../lib/otp";
import User from "../../../../database/models/User";
import Membership from "../../../../database/models/Membership";
import SignupVerification from "../../../../database/models/SignupVerification";

export const runtime = "nodejs";

const EXPIRED = "کد منقضی شده یا درخواستی پیدا نشد. دوباره درخواست ثبت‌نام بدهید.";

// Step 2: the 4-digit code from the e-mail. Only now the (pending) account is created and the owner is told.
export async function POST(request) {
  try {
    const limit = await hit(`signup-verify:ip:${clientIp(request)}`, { max: 40, windowSec: 3600 });
    if (limit.limited) {
      return NextResponse.json({ error: "تعداد تلاش‌ها زیاد است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const code = normalizeCode(body.code);
    if (!email) return NextResponse.json({ error: "ایمیل نامعتبر است." }, { status: 400 });
    if (!code) return NextResponse.json({ error: "کد ۴ رقمی را کامل وارد کنید." }, { status: 400 });

    await connectToDatabase();

    // count the attempt atomically BEFORE comparing, so parallel guesses cannot exceed the limit
    const record = await SignupVerification.findOneAndUpdate(
      { emailKey: emailKey(email), codeExpiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!record) {
      // explain why: attempts used up, code timed out (a new one can be requested), or nothing pending at all
      const existing = await SignupVerification.findOne({ emailKey: emailKey(email), expiresAt: { $gt: new Date() } }).lean();
      if (existing && existing.attempts >= OTP_MAX_ATTEMPTS) {
        await SignupVerification.deleteOne({ _id: existing._id });
        return NextResponse.json({ error: "تعداد تلاش‌ها تمام شد. دوباره درخواست ثبت‌نام بدهید.", expired: true }, { status: 400 });
      }
      if (existing) {
        return NextResponse.json({ error: "مهلت این کد تمام شده است. روی «ارسال مجدد» بزنید تا کد جدید بگیرید.", codeExpired: true }, { status: 400 });
      }
      return NextResponse.json({ error: EXPIRED, expired: true }, { status: 400 });
    }

    if (!codeMatches(record.email, code, record.codeHash)) {
      const left = OTP_MAX_ATTEMPTS - record.attempts;
      if (left <= 0) {
        await SignupVerification.deleteOne({ _id: record._id });
        return NextResponse.json({ error: "تعداد تلاش‌ها تمام شد. دوباره درخواست ثبت‌نام بدهید.", expired: true }, { status: 400 });
      }
      return NextResponse.json({ error: `کد اشتباه است. ${left.toLocaleString("fa-IR")} تلاش دیگر دارید.` }, { status: 400 });
    }

    // single use: whoever deletes the record first wins
    const claimed = await SignupVerification.findOneAndDelete({ _id: record._id });
    if (!claimed) return NextResponse.json({ error: EXPIRED, expired: true }, { status: 400 });

    const workspace = await findPrimaryWorkspace();
    if (!signupRequestsEnabled(workspace)) {
      return NextResponse.json({ error: "ثبت‌نام با درخواست فعلاً بسته است.", expired: true }, { status: 403 });
    }
    if (await User.exists(emailMatch(claimed.email))) {
      return NextResponse.json({ error: "برای این ایمیل قبلاً حساب یا درخواست ثبت شده است.", expired: true }, { status: 409 });
    }

    let user;
    try {
      user = await User.create({ firstName: claimed.firstName, lastName: claimed.lastName, email: claimed.email, passwordHash: claimed.passwordHash });
    } catch (error) {
      if (error?.code === 11000) {
        return NextResponse.json({ error: "برای این ایمیل قبلاً حساب یا درخواست ثبت شده است.", expired: true }, { status: 409 });
      }
      throw error;
    }

    try {
      await Membership.create({ workspaceId: workspace._id, userId: user._id, role: "member", permissions: [], isActive: false, status: "pending" });
    } catch (error) {
      await User.deleteOne({ _id: user._id }).catch(() => {});
      throw error;
    }

    // tell the owners / managers (best effort)
    const pseudo = { workspace: { id: String(workspace._id) }, user: { id: String(user._id), firstName: user.firstName, lastName: user.lastName } };
    const entity = { entityType: "member", entityId: user._id, entityTitle: `${user.firstName} ${user.lastName}`, meta: { email: claimed.email } };
    await logActivity(pseudo, { type: "member.signup_request", ...entity });
    const managers = await Membership.find({
      workspaceId: workspace._id,
      isActive: true,
      $or: [{ role: "owner" }, { permissions: "members.manage" }],
    })
      .select("userId")
      .lean();
    await notify(pseudo, managers.map((m) => m.userId), { type: "member.signup_request", ...entity });

    return NextResponse.json({ ok: true, pending: true });
  } catch (error) {
    console.error("VERIFY_EMAIL_ERROR", error);
    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}
