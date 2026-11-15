import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { LOCALES, localizedPath } from "../lib/locales.ts";
import { PAGE_COPY, SITE_URL, languageAlternates } from "../lib/seo.ts";

const decode = (text) => text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map(([tag]) =>
  Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)])),
);

// Fetch only public HTML and metadata; this never calls a DB or mutation API.
export async function checkSeo(fetchPage) {
  for (const lang of LOCALES) {
    for (const page of ["home", "history"]) {
      const pathname = localizedPath(lang, page);
      const response = await fetchPage(pathname);
      assert.equal(response.status, 200, pathname);
      const html = await response.text();
      assert.equal(tags(html, "html")[0]?.lang, lang, `${pathname}: server HTML language`);
      const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
      assert.equal(title, page === "home" ? PAGE_COPY[lang].title : PAGE_COPY[lang].historyTitle, `${pathname}: title`);
      const meta = tags(html, "meta");
      const description = page === "home" ? PAGE_COPY[lang].description : PAGE_COPY[lang].historyDescription;
      assert.equal(meta.find((tag) => tag.name === "description")?.content, description, `${pathname}: description`);
      assert.equal(new URL(meta.find((tag) => tag.property === "og:url")?.content ?? "").href, `${SITE_URL}${pathname}`, `${pathname}: sharing URL`);
      assert.equal(meta.find((tag) => tag.property === "og:title")?.content, title, `${pathname}: sharing title`);
      const links = tags(html, "link");
      assert.equal(new URL(links.find((tag) => tag.rel === "canonical")?.href ?? "").href, `${SITE_URL}${pathname}`, `${pathname}: self canonical`);
      const alternates = links.filter((tag) => tag.rel === "alternate");
      assert.equal(alternates.length, LOCALES.length + 1, `${pathname}: alternate count`);
      for (const [locale, href] of Object.entries(languageAlternates(page))) {
        assert.equal(new URL(alternates.find((tag) => tag.hrefLang === locale || tag.hreflang === locale)?.href ?? "").href, href, `${pathname}: ${locale} alternate`);
      }
      if (page === "home") {
        assert.ok(html.includes(PAGE_COPY[lang].heading), `${pathname}: server-rendered game introduction`);
        const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "null");
        assert.equal(jsonLd?.inLanguage, lang, `${pathname}: structured data language`);
        assert.equal(jsonLd?.url, `${SITE_URL}${pathname}`, `${pathname}: structured data URL`);
        assert.equal(jsonLd?.offers.price, "0", `${pathname}: free game`);
        assert.ok(html.includes(`href="${localizedPath(lang, "history")}"`), `${pathname}: localized history link`);
      } else {
        assert.ok(html.includes(`href="${localizedPath(lang)}"`), `${pathname}: localized home link`);
      }
    }
  }
  const sitemap = await (await fetchPage("/sitemap.xml")).text();
  const entries = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, url]) => url);
  assert.equal(entries.length, LOCALES.length * 2);
  for (const lang of LOCALES) {
    for (const page of ["home", "history"]) assert.ok(entries.includes(`${SITE_URL}${localizedPath(lang, page)}`));
  }
  assert.ok(sitemap.includes('hreflang="en"'));
  assert.ok(sitemap.includes('hreflang="x-default"'));
  for (const path of ["/xx", "/xx/history", "/en/admin-console", "/en/api/drawings", "/admin-console", "/api/admin-console/drawings"]) {
    assert.equal((await fetchPage(path)).status, 404, `${path}: unsupported route`);
  }
  console.log("SEO checks passed: 14 pages, initial HTML languages and introductions, titles, descriptions, canonicals, reciprocal hreflang, structured data, localized links, sitemap, and unsupported routes.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = new URL(process.argv[2] ?? "http://localhost:3000");
  await checkSeo((pathname) => fetch(new URL(pathname, base)));
}
