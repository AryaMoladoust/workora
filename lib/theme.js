// Theme configuration shared by the server (root layout) and the client (ThemeSwitcher).
export const THEME_COOKIE = "workora_theme";
export const MODE_COOKIE = "workora_mode";

export const THEMES = [
  { id: "indigo", label: "ایندیگو", swatch: ["#4f46e5", "#7c3aed"] },
  { id: "ocean", label: "اقیانوس", swatch: ["#0369a1", "#4f46e5"] },
  { id: "emerald", label: "زمرد", swatch: ["#047857", "#0d9488"] },
  { id: "violet", label: "بنفش", swatch: ["#7c3aed", "#db2777"] },
  { id: "rose", label: "رز", swatch: ["#e11d48", "#c026d3"] },
  { id: "amber", label: "کهربا", swatch: ["#b45309", "#dc2626"] },
  { id: "graphite", label: "گرافیت", swatch: ["#334155", "#0f172a"] },
];

export const MODES = [
  { id: "light", label: "روشن" },
  { id: "dark", label: "تیره" },
  { id: "system", label: "سیستم" },
];

export const DEFAULT_THEME = "indigo";
export const DEFAULT_MODE = "system";

export function normalizeTheme(value) {
  return THEMES.some((t) => t.id === value) ? value : DEFAULT_THEME;
}

export function normalizeMode(value) {
  return MODES.some((m) => m.id === value) ? value : DEFAULT_MODE;
}

// ---- UI font (selectable like the color theme)
export const FONT_COOKIE = "workora_font";

export const FONTS = [
  { id: "vazirmatn", label: "وزیرمتن", note: "گرم و خوانا" },
  { id: "plex", label: "پلکس", note: "مدرن و تیز" },
  { id: "noto", label: "نوتو", note: "خنثی و رسمی" },
];

export const DEFAULT_FONT = "vazirmatn";

export function normalizeFont(value) {
  return FONTS.some((f) => f.id === value) ? value : DEFAULT_FONT;
}
