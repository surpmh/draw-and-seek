import type { Metadata } from "next";
import { LOCALES, localizedPath, type Lang } from "./locales";

export const SITE_URL = "https://drawandseek.com";

interface PageCopy {
  title: string;
  heading: string;
  description: string;
  historyTitle: string;
  historyDescription: string;
  loading: string;
}

export const PAGE_COPY: Record<Lang, PageCopy> = {
  ko: {
    title: "숨은그림찾기 | Draw & Seek",
    heading: "함께 그리고 찾는 온라인 숨은그림찾기",
    description: "무료 온라인 숨은그림찾기 게임 Draw & Seek. 거대한 공용 캔버스에 나만의 그림을 숨기고 다른 플레이어의 그림을 찾아보세요. 설치나 회원가입 없이 바로 즐길 수 있습니다.",
    historyTitle: "숨은그림찾기 역대 랭킹 | Draw & Seek",
    historyDescription: "가장 오래 숨겨진 그림과 이미 발견된 그림의 기록을 확인하세요. Draw & Seek의 역대 랭킹과 히스토리입니다.",
    loading: "캔버스 불러오는 중…",
  },
  en: {
    title: "Draw & Seek — Free Online Hidden Object Game",
    heading: "Draw, hide, and find on a giant shared canvas",
    description: "Play a free online hidden object game with drawings made by other players. Hide your own art on a giant shared canvas and see how long it stays undiscovered. No download or sign-up needed.",
    historyTitle: "Hidden Drawing Leaderboard & History | Draw & Seek",
    historyDescription: "Explore the longest-hidden drawings in Draw & Seek. See player rankings, discovered artwork, and drawings still waiting to be found on the shared canvas.",
    loading: "Loading the canvas…",
  },
  ja: {
    title: "Draw & Seek — 無料オンライン絵探しゲーム",
    heading: "大きなキャンバスで絵を描いて、隠して、探そう",
    description: "無料のオンライン絵探しゲーム Draw & Seek。共有キャンバスに自分の絵を隠し、ほかのプレイヤーの絵を探そう。ダウンロードや会員登録は不要です。",
    historyTitle: "隠された絵の歴代ランキングと履歴 | Draw & Seek",
    historyDescription: "長く隠れ続けた絵や発見された絵をチェック。Draw & Seek の歴代ランキングと履歴を楽しもう。",
    loading: "キャンバスを読み込み中…",
  },
  zh: {
    title: "Draw & Seek — 免费在线找隐藏图画游戏",
    heading: "在共享大画布上画画、藏画、找画",
    description: "免费体验 Draw & Seek 在线找画游戏。在巨大的共享画布中藏起自己的画，寻找其他玩家隐藏的作品。无需下载或注册，即可开始游戏。",
    historyTitle: "隐藏图画排行榜与历史记录 | Draw & Seek",
    historyDescription: "查看隐藏时间最长的图画、已被发现的作品和仍待寻找的画作。探索 Draw & Seek 排行榜与历史记录。",
    loading: "正在加载画布…",
  },
  es: {
    title: "Draw & Seek — Juego de objetos ocultos online gratis",
    heading: "Dibuja, esconde y busca en un gran lienzo compartido",
    description: "Juega gratis a buscar dibujos ocultos creados por otros jugadores. Esconde tu arte en un gran lienzo compartido y descubre cuánto dura sin ser encontrado. Sin descargas ni registro.",
    historyTitle: "Clasificación e historial de dibujos ocultos | Draw & Seek",
    historyDescription: "Descubre los dibujos que más tiempo han permanecido ocultos, las obras encontradas y la clasificación histórica de Draw & Seek.",
    loading: "Cargando el lienzo…",
  },
  fr: {
    title: "Draw & Seek — Jeu d’objets cachés en ligne gratuit",
    heading: "Dessinez, cachez et cherchez sur une grande toile partagée",
    description: "Trouvez les dessins cachés par d’autres joueurs dans ce jeu en ligne gratuit. Cachez vos créations sur une grande toile partagée. Sans téléchargement ni inscription.",
    historyTitle: "Classement et historique des dessins cachés | Draw & Seek",
    historyDescription: "Découvrez les dessins restés cachés le plus longtemps, les œuvres trouvées et le classement historique de Draw & Seek.",
    loading: "Chargement de la toile…",
  },
  de: {
    title: "Draw & Seek — Kostenloses Online-Wimmelbildspiel",
    heading: "Zeichne, verstecke und suche auf einer großen gemeinsamen Leinwand",
    description: "Finde versteckte Zeichnungen anderer Spieler in diesem kostenlosen Online-Suchspiel. Verstecke eigene Kunst auf einer gemeinsamen Leinwand. Ohne Download oder Anmeldung.",
    historyTitle: "Bestenliste und Verlauf versteckter Bilder | Draw & Seek",
    historyDescription: "Entdecke die am längsten versteckten Zeichnungen, gefundene Bilder und die historische Bestenliste von Draw & Seek.",
    loading: "Leinwand wird geladen…",
  },
};

const OG_LOCALES: Record<Lang, string> = {
  ko: "ko_KR", en: "en_US", ja: "ja_JP", zh: "zh_CN", es: "es_ES", fr: "fr_FR", de: "de_DE",
};

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  verification: { other: { "naver-site-verification": "6e507364c98b3b2859e9c3e9d69402e9ce74c2c0" } },
};

export function languageAlternates(page: "home" | "history") {
  return {
    ...Object.fromEntries(LOCALES.map((lang) => [lang, `${SITE_URL}${localizedPath(lang, page)}`])),
    "x-default": `${SITE_URL}${localizedPath("en", page)}`,
  };
}

export function pageMetadata(lang: Lang, page: "home" | "history" = "home"): Metadata {
  const copy = PAGE_COPY[lang];
  const title = page === "history" ? copy.historyTitle : copy.title;
  const description = page === "history" ? copy.historyDescription : copy.description;
  const url = `${SITE_URL}${localizedPath(lang, page)}`;
  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(page) },
    openGraph: {
      title, description, url, siteName: "Draw & Seek", type: "website",
      locale: OG_LOCALES[lang], alternateLocale: LOCALES.filter((locale) => locale !== lang).map((locale) => OG_LOCALES[locale]),
    },
    twitter: { card: "summary", title, description },
  };
}

export function gameStructuredData(lang: Lang) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Draw & Seek",
    url: `${SITE_URL}${localizedPath(lang)}`,
    description: PAGE_COPY[lang].description,
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    inLanguage: lang,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}
