import { connectToDatabase } from "./db";
import Profile from "../database/models/Profile";

export { EMPLOYMENT_TYPES, LANGUAGE_LEVELS, LINK_KEYS, linkHref } from "./profile-shared";
import { EMPLOYMENT_TYPES, LANGUAGE_LEVELS, LINK_KEYS } from "./profile-shared";

const MAX = { skills: 30, experiences: 20, education: 10, languages: 10 };
const clean = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const cleanMulti = (v, n) => String(v ?? "").replace(/\r/g, "").trim().slice(0, n);
const yearOf = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n >= 1300 && n <= 1500 ? n : null;
};
const monthOf = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
};

// Turns what the user typed into a safe link target ("" when it is not usable).
export function cleanLink(key, value) {
  let v = clean(value, 200);
  if (!v) return "";
  if (key === "telegram" || key === "instagram") {
    v = v.replace(/^@/, "");
    if (/^https?:\/\//i.test(v)) return /^https?:\/\/[^\s]+$/i.test(v) ? v : "";
    return /^[A-Za-z0-9_.]{2,64}$/.test(v) ? v : "";
  }
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return "";
    return u.toString().slice(0, 200);
  } catch {
    return "";
  }
}

// Validates the (partial) payload of the profile editor. Returns { data } with only the fields that were sent, or { error }.
export function parseProfilePayload(body) {
  const data = {};
  if (body.headline !== undefined) data.headline = clean(body.headline, 120);
  if (body.about !== undefined) data.about = cleanMulti(body.about, 2000);
  if (body.location !== undefined) data.location = clean(body.location, 80);

  if (body.links !== undefined) {
    const links = {};
    for (const key of LINK_KEYS) {
      const raw = body.links?.[key];
      const value = cleanLink(key, raw);
      if (clean(raw, 200) && !value) return { error: "یکی از لینک‌ها معتبر نیست." };
      links[key] = value;
    }
    data.links = links;
  }

  if (body.skills !== undefined) {
    const raw = Array.isArray(body.skills) ? body.skills : String(body.skills || "").split(/[,،\n]/);
    data.skills = [...new Set(raw.map((s) => clean(s, 40)).filter(Boolean))].slice(0, MAX.skills);
  }

  if (body.experiences !== undefined) {
    if (!Array.isArray(body.experiences) || body.experiences.length > MAX.experiences) return { error: "تعداد سوابق کاری بیش از حد است." };
    const list = [];
    for (const e of body.experiences) {
      const title = clean(e?.title, 100);
      if (!title) return { error: "عنوان شغلی را وارد کنید." };
      const current = Boolean(e.current);
      const fromYear = yearOf(e.fromYear);
      const toYear = current ? null : yearOf(e.toYear);
      if (fromYear && toYear && toYear < fromYear) return { error: "سال پایان نمی‌تواند قبل از سال شروع باشد." };
      list.push({
        ...(e._id && /^[a-f0-9]{24}$/i.test(String(e._id)) ? { _id: e._id } : {}),
        title,
        company: clean(e.company, 100),
        employmentType: EMPLOYMENT_TYPES[e.employmentType] ? e.employmentType : "",
        location: clean(e.location, 80),
        fromYear,
        fromMonth: fromYear ? monthOf(e.fromMonth) : null,
        toYear,
        toMonth: toYear ? monthOf(e.toMonth) : null,
        current,
        description: cleanMulti(e.description, 1000),
      });
    }
    data.experiences = list;
  }

  if (body.education !== undefined) {
    if (!Array.isArray(body.education) || body.education.length > MAX.education) return { error: "تعداد سوابق تحصیلی بیش از حد است." };
    const list = [];
    for (const e of body.education) {
      const school = clean(e?.school, 120);
      if (!school) return { error: "نام دانشگاه یا مؤسسه را وارد کنید." };
      const fromYear = yearOf(e.fromYear);
      const toYear = yearOf(e.toYear);
      if (fromYear && toYear && toYear < fromYear) return { error: "سال پایان نمی‌تواند قبل از سال شروع باشد." };
      list.push({
        ...(e._id && /^[a-f0-9]{24}$/i.test(String(e._id)) ? { _id: e._id } : {}),
        school,
        degree: clean(e.degree, 80),
        field: clean(e.field, 100),
        fromYear,
        toYear,
        description: cleanMulti(e.description, 500),
      });
    }
    data.education = list;
  }

  if (body.languages !== undefined) {
    if (!Array.isArray(body.languages) || body.languages.length > MAX.languages) return { error: "تعداد زبان‌ها بیش از حد است." };
    data.languages = body.languages
      .map((l) => ({ name: clean(l?.name, 40), level: LANGUAGE_LEVELS[l?.level] ? l.level : "professional" }))
      .filter((l) => l.name);
  }
  return { data };
}

export function serializeProfile(doc) {
  const p = doc || {};
  const links = {};
  for (const key of LINK_KEYS) links[key] = p.links?.[key] || "";
  return {
    headline: p.headline || "",
    about: p.about || "",
    location: p.location || "",
    links,
    skills: p.skills || [],
    experiences: (p.experiences || []).map((e) => ({
      id: String(e._id),
      title: e.title,
      company: e.company || "",
      employmentType: e.employmentType || "",
      location: e.location || "",
      fromYear: e.fromYear || null,
      fromMonth: e.fromMonth || null,
      toYear: e.toYear || null,
      toMonth: e.toMonth || null,
      current: Boolean(e.current),
      description: e.description || "",
    })),
    education: (p.education || []).map((e) => ({
      id: String(e._id),
      school: e.school,
      degree: e.degree || "",
      field: e.field || "",
      fromYear: e.fromYear || null,
      toYear: e.toYear || null,
      description: e.description || "",
    })),
    languages: (p.languages || []).map((l) => ({ name: l.name, level: l.level })),
    onboarded: Boolean(p.onboardedAt),
  };
}

// Completeness checklist (drives the progress ring and the "what to add next" hints).
export function completeness(profile, hasAvatar) {
  const steps = [
    { id: "avatar", label: "عکس پروفایل", weight: 15, done: Boolean(hasAvatar), href: "/profile#photo" },
    { id: "headline", label: "عنوان شغلی", weight: 15, done: Boolean(profile.headline), href: "/profile#about" },
    { id: "about", label: "درباره‌ی من", weight: 15, done: profile.about.length >= 40, href: "/profile#about" },
    { id: "skills", label: "حداقل ۳ مهارت", weight: 15, done: profile.skills.length >= 3, href: "/profile#skills" },
    { id: "experience", label: "یک سابقه‌ی کاری", weight: 15, done: profile.experiences.length >= 1, href: "/profile#experience" },
    { id: "education", label: "سابقه‌ی تحصیلی", weight: 10, done: profile.education.length >= 1, href: "/profile#education" },
    { id: "location", label: "محل سکونت", weight: 5, done: Boolean(profile.location), href: "/profile#about" },
    { id: "links", label: "یک لینک (لینکدین، گیت‌هاب ...)", weight: 5, done: Object.values(profile.links).some(Boolean), href: "/profile#links" },
    { id: "languages", label: "زبان‌ها", weight: 5, done: profile.languages.length >= 1, href: "/profile#languages" },
  ];
  const percent = steps.reduce((sum, s) => sum + (s.done ? s.weight : 0), 0);
  return { percent, steps, missing: steps.filter((s) => !s.done) };
}

export async function getProfileDoc(userId) {
  await connectToDatabase();
  return Profile.findOne({ userId }).lean();
}

export const avatarPath = (userId, version) => `/api/avatar/${userId}${version ? `?v=${new Date(version).getTime()}` : ""}`;
