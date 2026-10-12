import crypto from "node:crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db";
import { sanitize } from "../../../lib/errors";
import * as models from "../../../database/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenOk(provided) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// One-time / maintenance endpoint:  GET /api/setup?token=<SETUP_TOKEN>
// Creates every collection + index defined by the models and reports what exists.
// Without SETUP_TOKEN in the environment the route behaves as if it did not exist.
export async function GET(request) {
  if (!process.env.SETUP_TOKEN) return new NextResponse("Not found", { status: 404 });

  const { searchParams } = new URL(request.url);
  const provided = searchParams.get("token") || request.headers.get("x-setup-token");
  if (!tokenOk(provided)) return NextResponse.json({ error: "توکن نامعتبر است." }, { status: 401 });

  // what the server can see (booleans only, never the values)
  const env = {
    MONGODB_URI: Boolean(process.env.MONGODB_URI),
    MONGODB_DB: process.env.MONGODB_DB || "(default: workora)",
    AUTH_SECRET_ok: (process.env.AUTH_SECRET || "").length >= 32,
    REGISTRATION_KEY: Boolean(process.env.REGISTRATION_KEY),
    NEXT_PUBLIC_REALTIME: process.env.NEXT_PUBLIC_REALTIME || "(not set)",
    node: process.version,
  };

  try {
    await connectToDatabase();
    const report = [];

    for (const [name, Model] of Object.entries(models)) {
      const entry = { model: name, collection: Model.collection.name };
      try {
        await Model.createCollection().catch(() => {}); // already exists → fine
        await Model.syncIndexes();
        const indexes = await Model.collection.indexes();
        entry.indexes = indexes.length;
        entry.documents = await Model.estimatedDocumentCount();
        entry.ok = true;
      } catch (error) {
        entry.ok = false;
        entry.error = error.message;
      }
      report.push(entry);
    }

    return NextResponse.json({
      ok: report.every((r) => r.ok) && env.AUTH_SECRET_ok,
      env,
      database: mongoose.connection.name,
      collections: report,
    });
  } catch (error) {
    console.error("SETUP_ERROR", error);
    return NextResponse.json({ ok: false, env, error: sanitize(error.message), errorName: error.name }, { status: 500 });
  }
}
