import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/fredoka";
import "@fontsource/bagel-fat-one/latin-400.css";
import "./globals.css";
import { Providers } from "./providers";
import { UI_PREFS_BOOTSTRAP_SCRIPT } from "@/lib/ui-prefs";

export const metadata: Metadata = {
  title: "MUSE | Music by conversation",
  description: "Tell MUSE the mood. It answers with real songs, checked against Deezer and iTunes, Nigeria first.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon.ico', sizes: '48x48' },
    ],
    apple: [
      { url: '/favicon-180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MUSE',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
  width: "device-width",
  initialScale: 1,
  // Lets bottom bars extend under the home indicator and pad themselves with
  // env(safe-area-inset-bottom) through --muse-safe-bottom.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme and data-effects are stamped before paint by the head script
    // from the choices kept on the device; the server renders the defaults,
    // so hydration must not complain when a visitor chose otherwise.
    <html
      lang="en"
      className="dark"
      data-theme="dark"
      data-effects="full"
      suppressHydrationWarning
    >
      <head>
        <script
          id="muse-ui-prefs"
          dangerouslySetInnerHTML={{ __html: UI_PREFS_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="font-ui antialiased bg-background text-text-primary selection:bg-accent selection:text-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
