import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

// e.g. "K7M2Q-9XPRA" (10 random characters ≈ 50 bits)
export function generateInviteCode() {
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function normalizeInviteCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// stored in normalized form (no dash) so lookups are simple
export function storedInviteCode(code) {
  return normalizeInviteCode(code);
}

export function displayInviteCode(stored) {
  const s = normalizeInviteCode(stored);
  return s.length === 10 ? `${s.slice(0, 5)}-${s.slice(5)}` : s;
}
