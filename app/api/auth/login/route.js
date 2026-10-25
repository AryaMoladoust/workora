import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../../../../lib/db";
import { createSession } from "../../../../lib/auth";
import { emailKey, emailMatch, isValidEmail, normalizeEmail } from "../../../../lib/validation";
import { clearHits, clientIp, hit } from "../../../../lib/rate-limit";
import { describeServerError } from "../../../../lib/errors";
import User from "../../../../database/models/User";
import Membership from "../../../../database/models/Membership";

export const runtime = "nodejs";

// compared against when the e-mail does not exist, so response time does not reveal valid accounts
let dummyHash = null;
const getDummyHash = () => (dummyHash ||= bcrypt.hash("workora-dummy-password", 12));

function tooMany(retryAfterSec) {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return NextResponse.json(
    { error: `تعداد تلاش‌های ناموفق زیاد است. ${minutes.toLocaleString("fa-IR")} دقیقه دیگر دوباره تلاش کنید.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!isValidEmail(email) || !password) {
      return NextResponse.json(
        { error: "ایمیل یا رمز عبور اشتباه است." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const ip = clientIp(request);
    // keyed by the canonical mailbox: a.b@gmail.com, ab@gmail.com and ab+x@gmail.com are ONE account for login,
    // so they must also share one set of attempts
    const accountKey = `login:acct:${ip}:${emailKey(email)}`;
    const [byIp, byAccount] = await Promise.all([
      hit(`login:ip:${ip}`, { max: 60, windowSec: 900 }),
      hit(accountKey, { max: 8, windowSec: 900 }),
    ]);
    if (byIp.limited || byAccount.limited) return tooMany(Math.max(byIp.retryAfterSec, byAccount.retryAfterSec));

    const user = await User.findOne(emailMatch(email)).select("+passwordHash");
    if (!user || !user.isActive) {
      await bcrypt.compare(password, await getDummyHash());
      return NextResponse.json(
        { error: "ایمیل یا رمز عبور اشتباه است." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "ایمیل یا رمز عبور اشتباه است." },
        { status: 401 }
      );
    }

    const membership = await Membership.findOne({
      userId: user._id,
      isActive: true,
    }).sort({ createdAt: 1 });

    if (!membership) {
      // correct password but not allowed in yet: tell sign-up requests they are waiting for approval
      const pending = await Membership.exists({ userId: user._id, status: "pending" });
      return NextResponse.json(
        { error: pending ? "درخواست ثبت‌نام شما هنوز توسط مالک تایید نشده است. بعد از تایید می‌توانید وارد شوید." : "حساب شما هنوز به Workspaceای متصل نیست." },
        { status: 403 }
      );
    }

    // older accounts get their mailbox key now (one mailbox = one account)
    if (!user.emailKey) await User.updateOne({ _id: user._id, emailKey: { $exists: false } }, { $set: { emailKey: emailKey(user.email) } }).catch(() => {});

    await clearHits(accountKey);
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } }
    );

    await createSession({
      userId: String(user._id),
      workspaceId: String(membership.workspaceId),
      membershipId: String(membership._id),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LOGIN_ERROR", error);
    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}
