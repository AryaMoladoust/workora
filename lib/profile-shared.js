// Pure constants / helpers (no database import) so client components can use them too.
export const EMPLOYMENT_TYPES = {
  "full-time": "تمام‌وقت",
  "part-time": "پاره‌وقت",
  freelance: "فریلنس",
  contract: "قراردادی",
  internship: "کارآموزی",
  volunteer: "داوطلبانه",
};
export const LANGUAGE_LEVELS = { basic: "مقدماتی", conversational: "مکالمه", professional: "حرفه‌ای", native: "زبان مادری" };
export const LINK_KEYS = ["website", "linkedin", "github", "telegram", "instagram"];

export function linkHref(key, value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (key === "telegram") return `https://t.me/${value}`;
  if (key === "instagram") return `https://instagram.com/${value}`;
  return `https://${value}`;
}
