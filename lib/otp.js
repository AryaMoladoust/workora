import crypto from "node:crypto";
import { mailConfigured, sendOtpEmail, sendResetCodeEmail } from "./mail";

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
// A new code can be requested once the current one has run out (the old code stops working when a new one is sent).
export const OTP_RESEND_SECONDS = OTP_TTL_MINUTES * 60;
const RECORD_TTL_MINUTES = 60; // the sign-up data itself is kept a bit longer so "resend" still works after the code expired
export const OTP_MAX_SENDS_PER_HOUR = 5;

export const RESET_CODE_LENGTH = 6; // password reset uses a longer code than sign-up

export function generateCode(length = 4) {
  return String(crypto.randomInt(0, 10 ** length)).padStart(length, "0");
}

// Accepts Persian / Arabic digits too and returns "" unless the result is exactly `length` digits.
export function normalizeCode(value, length = 4) {
  const map = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9", "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  const digits = String(value || "").replace(/[۰-۹٠-٩]/g, (c) => map[c]).replace(/\s+/g, "");
  return new RegExp(`^\\d{${length}}$`).test(digits) ? digits : "";
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters long.");
  return value;
}

// The code itself is never stored – only a keyed hash bound to the e-mail address.
// `purpose` keeps a sign-up code from ever matching a password-reset code ("" keeps the original sign-up format).
export function hashCode(email, code, purpose = "") {
  return crypto.createHmac("sha256", secret()).update(`${purpose ? `${purpose}:` : ""}${email}:${code}`).digest("hex");
}

export function codeMatches(email, code, storedHash, purpose = "") {
  const a = Buffer.from(hashCode(email, code, purpose), "hex");
  const b = Buffer.from(String(storedHash || ""), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function otpExpiry() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

export function recordExpiry() {
  return new Date(Date.now() + RECORD_TTL_MINUTES * 60 * 1000);
}

// Sends the code by e-mail. Without SMTP it is only allowed in development (code printed to the server console).
export async function deliverCode({ email, name, code, kind = "signup" }) {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      const error = new Error("MAIL_NOT_CONFIGURED");
      error.code = "MAIL_NOT_CONFIGURED";
      throw error;
    }
    console.log(`[OTP – development / ${kind}] ${email} → ${code}`);
    return;
  }
  if (kind === "reset") await sendResetCodeEmail({ to: email, name, code });
  else await sendOtpEmail({ to: email, name, code });
}
