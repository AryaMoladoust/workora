import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { completeness, parseProfilePayload, serializeProfile } from "../../../../lib/profile";
import Profile from "../../../../database/models/Profile";

export const runtime = "nodejs";

// PUT { headline?, about?, location?, links?, skills?, experiences?, education?, languages?, finishOnboarding? }
// Only the fields that are sent are changed. `finishOnboarding: true` marks the first-login wizard as done.
export async function PUT(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { data, error } = parseProfilePayload(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const set = { ...data };
  if (body.finishOnboarding === true) set.onboardedAt = new Date();

  await connectToDatabase();
  const doc = await Profile.findOneAndUpdate(
    { userId: current.user.id },
    { $set: set, $setOnInsert: { userId: current.user.id } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  const profile = serializeProfile(doc);
  return NextResponse.json({ profile, completeness: completeness(profile, Boolean(current.user.avatarUrl)) });
}
