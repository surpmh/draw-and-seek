"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { LANGUAGE_MENU_LABELS, LANGUAGE_NAMES, LOCALES, localizedPath } from "@/lib/locales";

export function LanguageSwitcher() {
  const { lang } = useI18n();
  const pathname = usePathname();
  const page = pathname.endsWith("/history") ? "history" : "home";
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        menuRef.current?.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <details
      ref={menuRef}
      className="language-switcher"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.removeAttribute("open");
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={LANGUAGE_MENU_LABELS[lang]}>
        <span aria-hidden="true">🌐</span> {lang.toUpperCase()}
      </summary>
      <nav aria-label={LANGUAGE_MENU_LABELS[lang]}>
        {LOCALES.map((locale) => (
          <Link
            key={locale}
            href={localizedPath(locale, page)}
            hrefLang={locale}
            lang={locale}
            aria-current={locale === lang ? "page" : undefined}
            prefetch={false}
            onClick={() => menuRef.current?.removeAttribute("open")}
          >
            {LANGUAGE_NAMES[locale]}
          </Link>
        ))}
      </nav>
    </details>
  );
}
