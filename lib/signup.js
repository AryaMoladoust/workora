import { connectToDatabase } from "./db";
import Workspace from "../database/models/Workspace";

// Sign-up requests accept only these e-mail domains. Default: Gmail.
// Set SIGNUP_ALLOWED_DOMAINS="gmail.com,yahoo.com" to change, or SIGNUP_ALLOWED_DOMAINS="" to allow any e-mail.
export function allowedSignupDomains() {
  const raw = process.env.SIGNUP_ALLOWED_DOMAINS ?? "gmail.com";
  return String(raw)
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function emailDomainAllowed(email) {
  const list = allowedSignupDomains();
  if (!list.length) return true;
  return list.includes(String(email).split("@").pop());
}

export function signupDomainHint() {
  const list = allowedSignupDomains();
  if (!list.length) return "";
  return list.length === 1 && list[0] === "gmail.com" ? "Gmail" : list.join("، ");
}

// Sign-up requests join the (first) active workspace of this installation.
export async function findPrimaryWorkspace() {
  await connectToDatabase();
  return Workspace.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
}

export function signupRequestsEnabled(workspace) {
  return Boolean(workspace) && workspace.signupRequestsEnabled !== false;
}
