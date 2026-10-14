import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { clientIp, hit } from "../../../../lib/rate-limit";
import { normalizeEmail } from "../../../../lib/validation";
import { describeServerError } from "../../../../lib/errors";
import { OTP_MAX_SENDS_PER_HOUR, OTP_RESEND_SECONDS, deliverCode, generateCode, hashCode, otpExpiry } from "../../../../lib/otp";
import SignupVerification from "../../../../database/models/SignupVerification";

export const runtime = "nodejs";

// "Didn't receive it? Resend" – a fresh code (the old one stops working), at most once per minute.
export async function POST(request) {
  try {
    const ipLimit = await hit(`signup-resend:ip:${clientIp(request)}`, { max: 15, windowSec: 3600 });
    if (ipLimit.limited) {
      return NextResponse.json({ error: "تعداد تلاش‌ها زیاد است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email) return NextResponse.json({ error: "ایمیل نامعتبر است." }, { status: 400 });

    await connectToDatabase();
    const record = await SignupVerification.findOne({ email, expiresAt: { $gt: new Date() } });
    if (!record) {
      return NextResponse.json({ error: "درخواستی پیدا نشد. دوباره ثبت‌نام را شروع کنید.", expired: true }, { status: 400 });
    }

    const waited = (Date.now() - new Date(record.lastSentAt).getTime()) / 1000;
    if (waited < OTP_RESEND_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_SECONDS - waited);
      return NextResponse.json({ error: `${wait.toLocaleString("fa-IR")} ثانیه‌ی دیگر می‌توانید دوباره بفرستید.`, retryAfterSec: wait }, { status: 429 });
    }

    const perEmail = await hit(`signup-otp:email:${email}`, { max: OTP_MAX_SENDS_PER_HOUR, windowSec: 3600 });
    if (perEmail.limited) {
      return NextResponse.json({ error: "برای این ایمیل بیش از حد کد فرستاده شده است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const code = generateCode();
    await SignupVerification.updateOne(
      { _id: record._id },
      { $set: { codeHash: hashCode(email, code), attempts: 0, lastSentAt: new Date(), expiresAt: otpExpiry() } }
    );

    try {
      await deliverCode({ email, name: record.firstName, code });
    } catch (mailError) {
      console.error("OTP_RESEND_ERROR", mailError);
      return NextResponse.json({ error: "ارسال ایمیل ناموفق بود. چند لحظه بعد دوباره تلاش کنید." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, resendIn: OTP_RESEND_SECONDS });
  } catch (error) {
    console.error("RESEND_CODE_ERROR", error);
    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}
