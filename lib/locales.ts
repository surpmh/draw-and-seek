export const LOCALES = ["ko", "en", "ja", "zh", "es", "fr", "de"] as const;
export type Lang = (typeof LOCALES)[number];

export const LANGUAGE_NAMES: Record<Lang, string> = {
  ko: "한국어", en: "English", ja: "日本語", zh: "中文",
  es: "Español", fr: "Français", de: "Deutsch",
};

export const LANGUAGE_MENU_LABELS: Record<Lang, string> = {
  ko: "언어 선택", en: "Choose language", ja: "言語を選択", zh: "选择语言",
  es: "Elegir idioma", fr: "Choisir la langue", de: "Sprache wählen",
};

export function isLang(value: string): value is Lang {
  return LOCALES.some((locale) => locale === value);
}

export function localizedPath(lang: Lang, page: "home" | "history" = "home"): string {
  const prefix = lang === "ko" ? "" : `/${lang}`;
  return page === "history" ? `${prefix}/history` : prefix || "/";
}
