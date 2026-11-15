import { notFound } from "next/navigation";
import HistoryList from "@/app/history/HistoryList";
import { isLang } from "@/lib/locales";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLang(locale)) notFound();
  return pageMetadata(locale, "history");
}

export default function HistoryPage() {
  return <HistoryList />;
}
