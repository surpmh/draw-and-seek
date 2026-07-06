import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const title = "숨은그림찾기 | Draw & Seek";
const description =
  "온라인 숨은그림찾기 게임 Draw & Seek. 거대한 캔버스에 그림을 그려 숨기고, 다른 사람들이 숨긴 그림을 찾아보세요. 무료로 즐기는 웹 기반 그림 숨바꼭질.";

export const metadata: Metadata = {
  metadataBase: new URL("https://drawandseek.com"),
  title,
  description,
  keywords: [
    "숨은그림찾기",
    "숨은 그림 찾기",
    "그림찾기 게임",
    "그림 숨바꼭질",
    "그림 그리기 게임",
    "함께 그림 그리기",
    "온라인 그림판 게임",
    "그림 그려서 숨기기",
    "온라인 그림 게임",
    "웹 게임",
    "무료 온라인 게임",
    "협동 게임",
    "캔버스 게임",
    "Draw and Seek",
    "hidden picture game",
    "drawing game",
  ],
  openGraph: {
    title,
    description,
    url: "https://drawandseek.com",
    siteName: "Draw & Seek",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  verification: {
    other: {
      "naver-site-verification": "6e507364c98b3b2859e9c3e9d69402e9ce74c2c0",
    },
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
