import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const title = "Draw & Seek";
const description = "그림을 그려 거대한 캔버스에 숨기고, 숨겨진 그림을 찾아보세요";

export const metadata: Metadata = {
  metadataBase: new URL("https://drawandseek.com"),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "https://drawandseek.com",
    siteName: title,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 모바일 확대는 캔버스 핀치 제스처로만 — 페이지 자체 확대 방지
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // env(safe-area-inset-*) 활성화 (노치/홈바)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={inter.variable}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
