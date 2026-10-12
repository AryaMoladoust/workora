import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../../../../lib/db";
import { createSession } from "../../../../lib/auth";
import { isValidEmail, normalizeEmail, validateName, validatePassword } from "../../../../lib/validation";
import { clientIp, hit } from "../../../../lib/rate-limit";
import { registrationKeyValid, registrationOpen } from "../../../../lib/registration";
import { describeServerError } from "../../../../lib/errors";
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

export async function POST(request) {
  let createdUserId = null;
  let createdWorkspaceId = null;

  try {
    if (!(await registrationOpen())) {
      return NextResponse.json(
        { error: "ثبت‌نام عمومی بسته است. مالک فضای کاری باید برای شما حساب بسازد." },
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
