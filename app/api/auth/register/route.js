import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../../../../lib/db";
import { createSession } from "../../../../lib/auth";
import { isValidEmail, normalizeEmail, validateName, validatePassword } from "../../../../lib/validation";
import { clientIp, hit } from "../../../../lib/rate-limit";
import { registrationKeyValid, registrationOpen } from "../../../../lib/registration";
import { describeServerError } from "../../../../lib/errors";
import { normalizeInviteCode } from "../../../../lib/invite";
import { logActivity, notify } from "../../../../lib/activity";
import { emailDomainAllowed, findPrimaryWorkspace, signupDomainHint, signupRequestsEnabled } from "../../../../lib/signup";
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

// Team member signs up with the workspace invite code (created by the owner on the Members page).
async function joinWithInviteCode(request, body) {
  let createdUserId = null;
  try {
    const limit = await hit(`join:ip:${clientIp(request)}`, { max: 10, windowSec: 3600 });
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

    await connectToDatabase();
    const code = normalizeInviteCode(body.inviteCode);
    const workspace = code ? await Workspace.findOne({ inviteCode: code, inviteEnabled: true, isActive: true }).lean() : null;
    if (!workspace) {
      return NextResponse.json({ error: "کد دعوت نامعتبر یا غیرفعال است. از مالک فضای کاری کد درست را بگیرید." }, { status: 403 });
    }

    if (await User.exists({ email })) {
      return NextResponse.json({ error: "ثبت‌نام با این ایمیل امکان‌پذیر نیست. اگر قبلاً حساب دارید وارد شوید." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ firstName, lastName, email, passwordHash });
    createdUserId = user._id;

    const membership = await Membership.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: "member",
      permissions: [],
    });

    await createSession({
      userId: String(user._id),
      workspaceId: String(workspace._id),
      membershipId: String(membership._id),
    });

    await logActivity(
      { workspace: { id: String(workspace._id) }, user: { id: String(user._id), firstName, lastName } },
      { type: "member.joined", entityType: "member", entityId: user._id, entityTitle: `${firstName} ${lastName}` }
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (createdUserId) {
      await Membership.deleteMany({ userId: createdUserId }).catch(() => {});
      await User.deleteOne({ _id: createdUserId }).catch(() => {});
    }
    if (error?.code === 11000) {
      return NextResponse.json({ error: "اطلاعات واردشده قبلاً استفاده شده است." }, { status: 409 });
    }
    console.error("JOIN_ERROR", error);
    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}

// Anyone can ask for access with their (Gmail) address. The account is created but stays "pending"
// (no session, cannot log in) until an owner / manager approves it on the Members page.
async function requestAccess(request, body) {
  let createdUserId = null;
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

    if (await User.exists({ email })) {
      return NextResponse.json(
        { error: "با این ایمیل نمی‌توان درخواست داد. اگر قبلاً درخواست داده‌اید منتظر تایید مالک بمانید، و اگر حساب دارید وارد شوید." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ firstName, lastName, email, passwordHash });
    createdUserId = user._id;

    await Membership.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: "member",
      permissions: [],
      isActive: false,
      status: "pending",
    });

    // tell the owners / managers (best effort)
    const pseudo = { workspace: { id: String(workspace._id) }, user: { id: String(user._id), firstName, lastName } };
    const entity = { entityType: "member", entityId: user._id, entityTitle: `${firstName} ${lastName}`, meta: { email } };
    await logActivity(pseudo, { type: "member.signup_request", ...entity });
    const managers = await Membership.find({
      workspaceId: workspace._id,
      isActive: true,
      $or: [{ role: "owner" }, { permissions: "members.manage" }],
    })
      .select("userId")
      .lean();
    await notify(pseudo, managers.map((m) => m.userId), { type: "member.signup_request", ...entity });

    return NextResponse.json({ ok: true, pending: true }, { status: 201 });
  } catch (error) {
    if (createdUserId) {
      await Membership.deleteMany({ userId: createdUserId }).catch(() => {});
      await User.deleteOne({ _id: createdUserId }).catch(() => {});
    }
    if (error?.code === 11000) {
      return NextResponse.json({ error: "اطلاعات واردشده قبلاً استفاده شده است." }, { status: 409 });
    }
    console.error("SIGNUP_REQUEST_ERROR", error);
    const described = describeServerError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}

export async function POST(request) {
  let createdUserId = null;
  let createdWorkspaceId = null;

  try {
    // a request carrying an invite code is a team member joining an existing workspace
    const peek = await request.clone().json().catch(() => ({}));
    if (peek && peek.inviteCode) return joinWithInviteCode(request, peek);
    if (peek && peek.signupRequest) return requestAccess(request, peek);

    if (!(await registrationOpen())) {
      return NextResponse.json(
        { error: "ساخت Workspace جدید بسته است. برای پیوستن به تیم از «کد دعوت» استفاده کنید یا از مالک بخواهید حساب بسازد." },
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

    const existing = await User.exists({ email });
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
