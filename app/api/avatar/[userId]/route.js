import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import UserAvatar from "../../../../database/models/UserAvatar";
import Membership from "../../../../database/models/Membership";

export const runtime = "nodejs";

// Profile photo of a workspace member. Only signed-in members of the same workspace may load it.
export async function GET(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return new NextResponse(null, { status: 401 });
  if (!mongoose.isValidObjectId(params.userId)) return new NextResponse(null, { status: 404 });

  await connectToDatabase();
  const member = await Membership.exists({ workspaceId: current.workspace.id, userId: params.userId, isActive: true });
  if (!member) return new NextResponse(null, { status: 404 });

  const avatar = await UserAvatar.findOne({ userId: params.userId }).lean();
  if (!avatar) return new NextResponse(null, { status: 404 });

  const body = avatar.data.buffer ? Buffer.from(avatar.data.buffer, avatar.data.byteOffset, avatar.data.length) : Buffer.from(avatar.data);
  return new NextResponse(body, {
    headers: {
      "Content-Type": avatar.contentType,
      "Content-Length": String(body.length),
      // the URL carries ?v=<timestamp>, so it can be cached for long; private because it needs a session
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
