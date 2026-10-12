// Web App Manifest → served at /manifest.webmanifest (Next.js adds the <link rel="manifest"> automatically).
export default function manifest() {
  return {
    id: "/",
    name: "Workora",
    short_name: "Workora",
    description: "فضای کاری تیم و مدیریت پروژه",
    lang: "fa",
    dir: "rtl",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0d13",
    theme_color: "#4f46e5",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "پروژه‌ها", url: "/projects", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "وظایف من", url: "/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "چت", url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
