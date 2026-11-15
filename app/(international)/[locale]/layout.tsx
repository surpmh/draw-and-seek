import { notFound } from "next/navigation";
import { SiteDocument, siteViewport } from "@/components/SiteDocument";
import { LOCALES, isLang } from "@/lib/locales";
import { siteMetadata } from "@/lib/seo";

export const metadata = siteMetadata;
export const viewport = siteViewport;
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "ko").map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLang(locale) || locale === "ko") notFound();
  return <SiteDocument lang={locale}>{children}</SiteDocument>;
}
