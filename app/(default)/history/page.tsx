import HistoryList from "@/app/history/HistoryList";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("ko", "history");

export default function HistoryPage() {
  return <HistoryList />;
}
