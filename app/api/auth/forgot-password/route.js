import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../../../../lib/db";
import { clientIp, hit } from "../../../../lib/rate-limit";
import { emailKey, emailMatch, isValidEmail, normalizeEmail, validatePassword } from "../../../../lib/validation";
import { describeServerError } from "../../../../lib/errors";
import { mailConfigured } from "../../../../lib/mail";
import { OTP_MAX_SENDS_PER_HOUR, OTP_RESEND_SECONDS, RESET_CODE_LENGTH, deliverCode, generateCode, hashCode, otpExpiry, recordExpiry } from "../../../../lib/otp";
import User from "../../../../database/models/User";
import Membership from "../../../../database/models/Membership";
import PasswordReset from "../../../../database/models/PasswordReset";

export const runtime = "nodejs";

// Step 1 of "forgot password": e-mail + the NEW password. A 6-digit code goes to that e-mail; the password
// is only changed in /api/auth/reset-password once the code is right.
// The answer is the same whether or not the address belongs to an account.
export async function POST(request) {
  try {
    const limit = await hit(`reset-request:ip:${clientIp(request)}`, { max: 8, windowSec: 3600 });
    if (limit.limited) {
      return NextResponse.json({ error: "تعداد تلاش‌ها زیاد است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!isValidEmail(email) || email.length > 160) {
      return NextResponse.json({ error: "ایمیل معتبر نیست." }, { status: 400 });
    }
    const problem = validatePassword(password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    if (process.env.NODE_ENV === "production" && !mailConfigured()) {
      console.error("RESET_MAIL_NOT_CONFIGURED: set SMTP_USER and SMTP_PASS");
      return NextResponse.json({ error: "ارسال ایمیل روی سرور تنظیم نشده است. با مالک تماس بگیرید." }, { status: 503 });
    }

    await connectToDatabase();
    const perEmail = await hit(`reset-otp:email:${emailKey(email)}`, { max: OTP_MAX_SENDS_PER_HOUR, windowSec: 3600 });
    if (perEmail.limited) {
      return NextResponse.json({ error: "برای این ایمیل بیش از حد کد فرستاده شده است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    // always hash, so the response time does not reveal whether the account exists
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.findOne({ ...emailMatch(email), isActive: true }).select("_id firstName email").lean();
    const eligible = user ? Boolean(await Membership.exists({ userId: user._id, isActive: true, status: { $ne: "pending" } })) : false;

    if (eligible) {
      const code = generateCode(RESET_CODE_LENGTH);
      // the code always goes to the address stored on the account (the owner of the mailbox)
      const target = user.email;
      await PasswordReset.findOneAndUpdate(
        { emailKey: emailKey(target) },
        { $set: { email: target, emailKey: emailKey(target), userId: user._id, passwordHash, codeHash: hashCode(target, code, "reset"), attempts: 0, lastSentAt: new Date(), codeExpiresAt: otpExpiry(), expiresAt: recordExpiry() } },
        { upsert: true, new: true }
      );
      try {
        await deliverCode({ email: target, name: user.firstName, code, kind: "reset" });
      } catch (mailError) {
        await PasswordReset.deleteOne({ emailKey: emailKey(target) }).catch(() => {});
        console.error("RESET_MAIL_ERROR", mailError);
        return NextResponse.json({ error: "ارسال ایمیل ناموفق بود. چند لحظه بعد دوباره تلاش کنید." }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true, step: "verify", email, resendIn: OTP_RESEND_SECONDS, length: RESET_CODE_LENGTH });
  } catch (error) {
    console.error("FORGOT_PASSWORD_ERROR", error);
    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}
