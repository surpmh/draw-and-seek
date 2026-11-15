import { notFound } from "next/navigation";
import { GamePage } from "@/components/GamePage";
import { isLang } from "@/lib/locales";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLang(locale)) notFound();
  return pageMetadata(locale);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isLang(locale)) notFound();
  return <GamePage lang={locale} />;
}
