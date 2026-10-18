import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { clientIp, hit } from "../../../../lib/rate-limit";
import { emailKey, normalizeEmail } from "../../../../lib/validation";
import { describeServerError } from "../../../../lib/errors";
import { OTP_MAX_ATTEMPTS, RESET_CODE_LENGTH, codeMatches, normalizeCode } from "../../../../lib/otp";
import User from "../../../../database/models/User";
import Membership from "../../../../database/models/Membership";
import PasswordReset from "../../../../database/models/PasswordReset";

export const runtime = "nodejs";

const EXPIRED = "کد منقضی شده یا درخواستی پیدا نشد. دوباره بازیابی رمز را شروع کنید.";

// Step 2: the 6-digit code. If it is right the new password is applied and every old session is signed out.
export async function POST(request) {
  try {
    const limit = await hit(`reset-verify:ip:${clientIp(request)}`, { max: 40, windowSec: 3600 });
    if (limit.limited) {
      return NextResponse.json({ error: "تعداد تلاش‌ها زیاد است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const code = normalizeCode(body.code, RESET_CODE_LENGTH);
    if (!email) return NextResponse.json({ error: "ایمیل نامعتبر است." }, { status: 400 });
    if (!code) return NextResponse.json({ error: `کد ${RESET_CODE_LENGTH.toLocaleString("fa-IR")} رقمی را کامل وارد کنید.` }, { status: 400 });

    await connectToDatabase();

    // count the attempt atomically BEFORE comparing, so parallel guesses cannot exceed the limit
    const record = await PasswordReset.findOneAndUpdate(
      { emailKey: emailKey(email), codeExpiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!record) {
      const existing = await PasswordReset.findOne({ emailKey: emailKey(email), expiresAt: { $gt: new Date() } }).lean();
      if (existing && existing.attempts >= OTP_MAX_ATTEMPTS) {
        await PasswordReset.deleteOne({ _id: existing._id });
        return NextResponse.json({ error: "تعداد تلاش‌ها تمام شد. دوباره بازیابی رمز را شروع کنید.", expired: true }, { status: 400 });
      }
      if (existing) {
        return NextResponse.json({ error: "مهلت این کد تمام شده است. روی «ارسال مجدد» بزنید تا کد جدید بگیرید.", codeExpired: true }, { status: 400 });
      }
      return NextResponse.json({ error: EXPIRED, expired: true }, { status: 400 });
    }

    if (!codeMatches(record.email, code, record.codeHash, "reset")) {
      const left = OTP_MAX_ATTEMPTS - record.attempts;
      if (left <= 0) {
        await PasswordReset.deleteOne({ _id: record._id });
        return NextResponse.json({ error: "تعداد تلاش‌ها تمام شد. دوباره بازیابی رمز را شروع کنید.", expired: true }, { status: 400 });
      }
      return NextResponse.json({ error: `کد اشتباه است. ${left.toLocaleString("fa-IR")} تلاش دیگر دارید.` }, { status: 400 });
    }

    // single use: whoever deletes the record first wins
    const claimed = await PasswordReset.findOneAndDelete({ _id: record._id });
    if (!claimed) return NextResponse.json({ error: EXPIRED, expired: true }, { status: 400 });

    const user = await User.findOne({ _id: claimed.userId, isActive: true }).select("_id").lean();
    const allowed = user ? await Membership.exists({ userId: user._id, isActive: true, status: { $ne: "pending" } }) : null;
    if (!allowed) return NextResponse.json({ error: EXPIRED, expired: true }, { status: 400 });

    await User.updateOne({ _id: user._id }, { $set: { passwordHash: claimed.passwordHash, passwordChangedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("RESET_PASSWORD_ERROR", error);
    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}
