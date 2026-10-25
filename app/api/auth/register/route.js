import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../../../../lib/db";
import { createSession } from "../../../../lib/auth";
import { emailKey, emailMatch, isValidEmail, normalizeEmail, validateName, validatePassword } from "../../../../lib/validation";
import { clientIp, hit } from "../../../../lib/rate-limit";
import { registrationKeyValid, registrationOpen } from "../../../../lib/registration";
import { describeServerError } from "../../../../lib/errors";
import { logActivity, notify } from "../../../../lib/activity";
import { emailDomainAllowed, findPrimaryWorkspace, signupDomainHint, signupRequestsEnabled } from "../../../../lib/signup";
import { OTP_MAX_SENDS_PER_HOUR, OTP_RESEND_SECONDS, deliverCode, generateCode, hashCode, otpExpiry, recordExpiry } from "../../../../lib/otp";
import SignupVerification from "../../../../database/models/SignupVerification";
import User from "../../../../database/models/User";
import Workspace from "../../../../database/models/Workspace";
import Membership from "../../../../database/models/Membership";

export const runtime = "nodejs";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

async function makeUniqueSlug(workspaceName, userId) {
  const base = slugify(workspaceName) || `workspace-${String(userId).slice(-8)}`;
  let slug = base;

  if (await Workspace.exists({ slug })) {
    slug = `${base}-${String(userId).slice(-6)}`;
  }

  return slug;
}

// Step 1 of a sign-up request: validate the form and e-mail a 4-digit code.
// The account is NOT created yet – that happens in /api/auth/verify-email once the code is correct,
// and only then is the owner asked to approve.
async function requestAccess(request, body) {
  try {
    const limit = await hit(`signup-request:ip:${clientIp(request)}`, { max: 8, windowSec: 3600 });
    if (limit.limited) {
      return NextResponse.json({ error: "تعداد تلاش‌ها زیاد است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    const problem = validateName(firstName, "نام") || validateName(lastName, "نام خانوادگی") || validatePassword(password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    if (!isValidEmail(email) || email.length > 160) {
      return NextResponse.json({ error: "ایمیل معتبر نیست." }, { status: 400 });
    }
    if (!emailDomainAllowed(email)) {
      return NextResponse.json({ error: `فقط ایمیل ${signupDomainHint()} پذیرفته می‌شود.` }, { status: 400 });
    }

    await connectToDatabase();
    const workspace = await findPrimaryWorkspace();
    if (!signupRequestsEnabled(workspace)) {
      return NextResponse.json({ error: "ثبت‌نام با درخواست فعلاً بسته است. با مالک فضای کاری تماس بگیرید." }, { status: 403 });
    }

    if (await User.exists(emailMatch(email))) {
      return NextResponse.json(
        { error: "با این ایمیل نمی‌توان درخواست داد. اگر قبلاً درخواست داده‌اید منتظر تایید مالک بمانید، و اگر حساب دارید وارد شوید." },
        { status: 409 }
      );
    }

    // protects the mailbox of the address owner from being flooded with codes
    const perEmail = await hit(`signup-otp:email:${emailKey(email)}`, { max: OTP_MAX_SENDS_PER_HOUR, windowSec: 3600 });
    if (perEmail.limited) {
      return NextResponse.json({ error: "برای این ایمیل بیش از حد کد فرستاده شده است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const code = generateCode();
    const passwordHash = await bcrypt.hash(password, 12);
    await SignupVerification.findOneAndUpdate(
      { emailKey: emailKey(email) },
      { $set: { email, emailKey: emailKey(email), firstName, lastName, passwordHash, codeHash: hashCode(email, code), attempts: 0, lastSentAt: new Date(), codeExpiresAt: otpExpiry(), expiresAt: recordExpiry() } },
      { upsert: true, new: true }
    );

    try {
      await deliverCode({ email, name: firstName, code });
    } catch (mailError) {
      await SignupVerification.deleteOne({ emailKey: emailKey(email) }).catch(() => {});
      if (mailError?.code === "MAIL_NOT_CONFIGURED") {
        console.error("OTP_MAIL_NOT_CONFIGURED: set SMTP_USER and SMTP_PASS");
        return NextResponse.json({ error: "ارسال ایمیل روی سرور تنظیم نشده است. با مالک تماس بگیرید." }, { status: 503 });
      }
      console.error("OTP_MAIL_ERROR", mailError);
      return NextResponse.json({ error: "ارسال ایمیل ناموفق بود. آدرس را بررسی کنید و دوباره تلاش کنید." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, step: "verify", email, resendIn: OTP_RESEND_SECONDS });
  } catch (error) {
    console.error("SIGNUP_REQUEST_ERROR", error);
    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}

export async function POST(request) {
  let createdUserId = null;
  let createdWorkspaceId = null;

  try {
    const peek = await request.clone().json().catch(() => ({}));
    if (peek && peek.signupRequest) return requestAccess(request, peek);

    if (!(await registrationOpen())) {
      return NextResponse.json(
        { error: "ساخت Workspace جدید بسته است. برای پیوستن به تیم از «درخواست ثبت‌نام» استفاده کنید یا از مالک بخواهید حساب بسازد." },
        { status: 403 }
      );
    }

    const limit = await hit(`register:ip:${clientIp(request)}`, { max: 6, windowSec: 3600 });
    if (limit.limited) {
      return NextResponse.json({ error: "تعداد تلاش‌ها زیاد است. بعداً دوباره تلاش کنید." }, { status: 429 });
    }

    const body = await request.json();
    if (!registrationKeyValid(body.registrationKey)) {
      return NextResponse.json({ error: "کد دعوت نادرست است." }, { status: 403 });
    }
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const workspaceName = String(body.workspaceName || "").trim();

    const firstNameError = validateName(firstName, "نام");
    const lastNameError = validateName(lastName, "نام خانوادگی");
    const passwordError = validatePassword(password);

    if (firstNameError || lastNameError || passwordError) {
      return NextResponse.json(
        { error: firstNameError || lastNameError || passwordError },
        { status: 400 }
      );
    }

    if (!isValidEmail(email) || email.length > 160) {
      return NextResponse.json({ error: "ایمیل معتبر نیست." }, { status: 400 });
    }

    if (workspaceName.length < 2 || workspaceName.length > 120) {
      return NextResponse.json({ error: "نام Workspace معتبر نیست." }, { status: 400 });
    }

    await connectToDatabase();

    const existing = await User.exists(emailMatch(email));
    if (existing) {
      return NextResponse.json(
        { error: "ثبت‌نام با این ایمیل امکان‌پذیر نیست." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstName,
      lastName,
      email,
      passwordHash,
    });
    createdUserId = user._id;

    const slug = await makeUniqueSlug(workspaceName, user._id);
    const workspace = await Workspace.create({
      name: workspaceName,
      slug,
      ownerUserIds: [user._id],
    });
    createdWorkspaceId = workspace._id;

    const membership = await Membership.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: "owner",
      permissions: [
        "workspace.manage",
        "members.manage",
        "projects.manage",
        "tasks.manage",
        "settings.manage",
      ],
    });

    await createSession({
      userId: String(user._id),
      workspaceId: String(workspace._id),
      membershipId: String(membership._id),
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (createdWorkspaceId) {
      await Workspace.deleteOne({ _id: createdWorkspaceId }).catch(() => {});
    }
    if (createdUserId) {
      await Membership.deleteMany({ userId: createdUserId }).catch(() => {});
      await User.deleteOne({ _id: createdUserId }).catch(() => {});
    }

    if (error?.code === 11000) {
      return NextResponse.json(
        { error: "اطلاعات واردشده قبلاً استفاده شده است." },
        { status: 409 }
      );
    }

    console.error("REGISTER_ERROR", error);

    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}
