import crypto from "node:crypto";
import { connectToDatabase } from "./db";
import Workspace from "../database/models/Workspace";

// Self-registration only creates a NEW workspace + its owner. For an internal company tool it is
// therefore open only until the first workspace exists (afterwards the owner creates accounts
// from the "Members" page). Set ALLOW_PUBLIC_REGISTRATION=true to keep it open.
export async function registrationOpen() {
  if (process.env.ALLOW_PUBLIC_REGISTRATION === "true") return true;
  await connectToDatabase();
  return (await Workspace.estimatedDocumentCount()) === 0;
}

// Optional invite code that protects the very first registration on a public URL.
export function registrationKeyRequired() {
  return Boolean(process.env.REGISTRATION_KEY);
}

export function registrationKeyValid(provided) {
  const expected = process.env.REGISTRATION_KEY;
  if (!expected) return true;
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
