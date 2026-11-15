import type { MetadataRoute } from "next";
import { LOCALES, localizedPath } from "@/lib/locales";
import { SITE_URL, languageAlternates } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.flatMap((lang) => (["home", "history"] as const).map((page) => ({
    url: `${SITE_URL}${localizedPath(lang, page)}`,
    changeFrequency: "daily" as const,
    priority: page === "home" ? 1 : 0.5,
    alternates: { languages: languageAlternates(page) },
  })));
}
