import type { Metadata } from "next";
import HistoryList from "./HistoryList";

export const metadata: Metadata = {
  title: "히스토리 — Draw & Seek",
  description: "역대 랭킹",
};

export default function HistoryPage() {
  return <HistoryList />;
}
