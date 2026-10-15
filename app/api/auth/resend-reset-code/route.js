import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { clientIp, hit } from "../../../../lib/rate-limit";
import { normalizeEmail } from "../../../../lib/validation";
import { describeServerError } from "../../../../lib/errors";
import { OTP_MAX_SENDS_PER_HOUR, OTP_RESEND_SECONDS, RESET_CODE_LENGTH, deliverCode, generateCode, hashCode, otpExpiry, recordExpiry } from "../../../../lib/otp";
import User from "../../../../database/models/User";
import PasswordReset from "../../../../database/models/PasswordReset";

export const runtime = "nodejs";

// A fresh reset code (the old one stops working), allowed once the current one has run out.
export async function POST(request) {
  try {
    const ipLimit = await hit(`reset-resend:ip:${clientIp(request)}`, { max: 15, windowSec: 3600 });
    if (ipLimit.limited) {
      return NextResponse.json({ error: "تعداد تلاش‌ها زیاد است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email) return NextResponse.json({ error: "ایمیل نامعتبر است." }, { status: 400 });

    await connectToDatabase();
    const record = await PasswordReset.findOne({ email, expiresAt: { $gt: new Date() } });
    if (!record) {
      return NextResponse.json({ error: "درخواستی پیدا نشد. بازیابی رمز را از اول شروع کنید.", expired: true }, { status: 400 });
    }

    const waited = (Date.now() - new Date(record.lastSentAt).getTime()) / 1000;
    if (waited < OTP_RESEND_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_SECONDS - waited);
      const clock = `${String(Math.floor(wait / 60)).padStart(2, "0")}:${String(wait % 60).padStart(2, "0")}`;
      return NextResponse.json({ error: `بعد از ${clock} دقیقه می‌توانید کد جدید بگیرید.`, retryAfterSec: wait }, { status: 429 });
    }

    const perEmail = await hit(`reset-otp:email:${email}`, { max: OTP_MAX_SENDS_PER_HOUR, windowSec: 3600 });
    if (perEmail.limited) {
      return NextResponse.json({ error: "برای این ایمیل بیش از حد کد فرستاده شده است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const user = await User.findById(record.userId).select("firstName").lean();
    const code = generateCode(RESET_CODE_LENGTH);
    await PasswordReset.updateOne(
      { _id: record._id },
      { $set: { codeHash: hashCode(email, code, "reset"), attempts: 0, lastSentAt: new Date(), codeExpiresAt: otpExpiry(), expiresAt: recordExpiry() } }
    );

    try {
      await deliverCode({ email, name: user?.firstName || "", code, kind: "reset" });
    } catch (mailError) {
      console.error("RESET_RESEND_ERROR", mailError);
      return NextResponse.json({ error: "ارسال ایمیل ناموفق بود. چند لحظه بعد دوباره تلاش کنید." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, resendIn: OTP_RESEND_SECONDS });
  } catch (error) {
    console.error("RESEND_RESET_ERROR", error);
    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}
