import { cookies } from "next/headers";
import { Vazirmatn, IBM_Plex_Sans_Arabic, Noto_Sans_Arabic, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "../components/layout/AppShell";
import PwaProvider from "../components/pwa/PwaProvider";
import { getCachedCurrentUser } from "../lib/require-auth";
import {
  THEME_COOKIE,
  MODE_COOKIE,
  FONT_COOKIE,
  normalizeTheme,
  normalizeMode,
  normalizeFont,
} from "../lib/theme";

// Fonts are downloaded at build time and self-hosted by Next.js (no request to Google at runtime).
// Only the selected UI font is actually used by the page; the others are fetched on demand.
const vazirmatn = Vazirmatn({ subsets: ["arabic", "latin"], display: "swap", variable: "--font-vazirmatn" });
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-plex", preload: false });
const noto = Noto_Sans_Arabic({ subsets: ["arabic"], display: "swap", variable: "--font-noto", preload: false });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata = {
  title: "Workora",
  description: "فضای کاری تیم و مدیریت پروژه",
  applicationName: "Workora",
  appleWebApp: { capable: true, title: "Workora", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// theme-color tints the browser / installed-app title bar (follows the chosen light / dark mode).
export async function generateViewport() {
  const store = await cookies();
  const mode = normalizeMode(store.get(MODE_COOKIE)?.value);
  const light = "#f6f7fa";
  const dark = "#0b0d13";
  const themeColor =
    mode === "light"
      ? light
      : mode === "dark"
        ? dark
        : [
            { media: "(prefers-color-scheme: light)", color: light },
            { media: "(prefers-color-scheme: dark)", color: dark },
          ];
  return { width: "device-width", initialScale: 1, viewportFit: "cover", colorScheme: "light dark", themeColor };
}

export default async function RootLayout({ children }) {
  const store = await cookies();
  const theme = normalizeTheme(store.get(THEME_COOKIE)?.value);
  const mode = normalizeMode(store.get(MODE_COOKIE)?.value);
  const font = normalizeFont(store.get(FONT_COOKIE)?.value);

  // Only the signed-in user is needed to draw the shell. Unread counters are fetched by the client
  // right after the first paint (see RealtimeProvider) so they never block the page.
  let current = null;
  try {
    current = await getCachedCurrentUser();
  } catch (error) {
    console.error("ROOT_LAYOUT_AUTH_ERROR", error);
  }

  return (
    <html
      lang="fa"
      dir="rtl"
      data-theme={theme}
      data-mode={mode}
      data-font={font}
      className={`${vazirmatn.variable} ${plex.variable} ${noto.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body>
        <PwaProvider signedIn={Boolean(current?.user)}>
          <AppShell
            user={current?.user ?? null}
            workspace={current?.workspace ?? null}
            role={current?.membership?.role ?? null}
            theme={theme}
            mode={mode}
            font={font}
          >
            {children}
          </AppShell>
        </PwaProvider>
      </body>
    </html>
  );
}
