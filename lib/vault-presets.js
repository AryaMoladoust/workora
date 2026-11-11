// Suggested entries every member gets (empty, ready to be filled in; each one can be deleted).
// Client-safe file: no server imports here.
export const VAULT_PRESETS = [
  { key: "github", title: "گیت‌هاب (GitHub)", url: "https://github.com", icon: "code" },
  { key: "linkedin", title: "لینکدین (LinkedIn)", url: "https://www.linkedin.com", icon: "users" },
  { key: "instagram", title: "اینستاگرام (Instagram)", url: "https://www.instagram.com", icon: "camera" },
  { key: "workora", title: "ورکورا (Workora)", url: "", icon: "layers" },
  { key: "bluebank", title: "بلوبانک (Blu Bank)", url: "", icon: "briefcase" },
];

export const PRESET_KEYS = VAULT_PRESETS.map((p) => p.key);
