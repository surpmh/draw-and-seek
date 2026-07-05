import type { Metadata } from "next";
import AdminApp from "./AdminApp";

export const metadata: Metadata = {
  title: "관리자 — Draw & Seek",
  robots: { index: false, follow: false }, // 숨은 페이지 — 검색엔진 노출 금지
};

export default function AdminPage() {
  return <AdminApp />;
}
