import { cookies } from "next/headers";
import { Vazirmatn, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "../components/layout/AppShell";
import { getCachedCurrentUser } from "../lib/require-auth";
import { unreadCountFor } from "../lib/notifications";
import { chatUnreadTotal } from "../lib/chat";
import {
  THEME_COOKIE,
  MODE_COOKIE,
  normalizeTheme,
  normalizeMode,
} from "../lib/theme";

// Fonts are downloaded at build time and self-hosted by Next.js (no request to Google at runtime).
const vazirmatn = Vazirmatn({ subsets: ["arabic", "latin"], display: "swap", variable: "--font-vazirmatn" });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata = { title: "Workora", description: "فضای کاری تیم و مدیریت پروژه" };

export const viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default async function RootLayout({ children }) {
  const store = await cookies();
  const theme = normalizeTheme(store.get(THEME_COOKIE)?.value);
  const mode = normalizeMode(store.get(MODE_COOKIE)?.value);

  let current = null;
  let unread = 0;
  let chatUnread = 0;
  try {
    current = await getCachedCurrentUser();
    if (current) [unread, chatUnread] = await Promise.all([unreadCountFor(current), chatUnreadTotal(current)]);
  } catch (error) {
    console.error("ROOT_LAYOUT_AUTH_ERROR", error);
  }

  return (
    <html lang="fa" dir="rtl" data-theme={theme} data-mode={mode} className={`${vazirmatn.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <AppShell
          user={current?.user ?? null}
          workspace={current?.workspace ?? null}
          role={current?.membership?.role ?? null}
          theme={theme}
          mode={mode}
          unread={unread}
          chatUnread={chatUnread}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
