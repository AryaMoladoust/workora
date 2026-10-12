import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { ok: false, database: "not_configured", message: "MONGODB_URI is not configured." },
      { status: 503 }
    );
  }

  try {
    const connection = await connectToDatabase();
    return NextResponse.json({
      ok: true,
      database: "connected",
      name: connection.connection.name,
      host: connection.connection.host,
    });
  } catch (error) {
    console.error("HEALTH_DB_ERROR", error);
    return NextResponse.json(
      {
        ok: false,
        database: "unavailable",
        message: process.env.NODE_ENV === "development"
          ? error?.message || "Database connection failed."
          : "Database connection failed.",
      },
      { status: 503 }
    );
  }
}
