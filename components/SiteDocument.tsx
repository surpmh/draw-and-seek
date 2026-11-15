import type { Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import { Analytics } from "./Analytics";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Separate root layouts let every static language URL emit the correct <html lang>.
export function SiteDocument({ children, lang }: { children: ReactNode; lang: Lang }) {
  return (
    <html lang={lang}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7669669855204826"
          crossOrigin="anonymous"
        />
      </head>
      <body className={inter.variable}>
        <LangProvider lang={lang}>{children}</LangProvider>
        <Analytics />
      </body>
    </html>
  );
}
