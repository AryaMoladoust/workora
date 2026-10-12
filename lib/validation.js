export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validatePassword(password) {
  if (password.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد.";
  if (Buffer.byteLength(password, "utf8") > 72) return "رمز عبور بیش از حد طولانی است (حداکثر ۷۲ بایت؛ حدود ۷۲ حرف انگلیسی).";
  return null;
}

export function validateName(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) return `${label} الزامی است.`;
  if (normalized.length < 2 || normalized.length > 80) return `${label} معتبر نیست.`;
  return null;
}

// Returns { ok: true, value: Date|null } or { ok: false }.
export function parseOptionalDate(value) {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { ok: false };
  return { ok: true, value: date };
}
