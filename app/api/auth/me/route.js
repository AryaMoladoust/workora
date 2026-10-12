import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getCurrentUser();

  if (!current) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, ...current });
}
