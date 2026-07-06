"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { DrawingItem } from "./Sidebar";



export function RankingPanel({
  items,
  hidden,
  open,
  onToggle,
}: {
  items: DrawingItem[];
  hidden?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const badgeLabel = (ms: number) => {
    const days = Math.floor(ms / 86400_000);
    if (days >= 1) return t.badgeDays(days);
    const hours = Math.floor(ms / 3600_000);
    if (hours >= 1) return t.badgeHours(hours);
    return t.badgeNew;
  };
  if (hidden) return null;
  // 밀리초 단위 경과시간으로 정밀 정렬 — 같은 날 숨긴 그림끼리도 순서가 갈린다
  const top = [...items].sort((a, b) => b.hiddenMs - a.hiddenMs).slice(0, 10);

  if (!open) {
    return (
      <button
        onClick={onToggle}
        title={t.rankingExpand}
        style={{
          position: "fixed",
          right: 16,
          top: 68,
          zIndex: 34,
          height: 40,
          padding: "0 14px",
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          backdropFilter: "blur(10px) saturate(1.5)",
          WebkitBackdropFilter: "blur(10px) saturate(1.5)",
          boxShadow: "var(--shadow)",
          color: "var(--text)",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          animation: "popIn .3s ease both",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        🏆 <span style={{ color: "var(--text2)", fontWeight: 500 }}>{t.rankingPill}</span>
      </button>
    );
  }

  return (
    <div
      data-screen-label="Ranking Panel"
      style={{
        position: "fixed",
        right: 16,
        top: 68,
        width: 288,
        zIndex: 34,
        background: "var(--surface)",
        backdropFilter: "blur(10px) saturate(1.5)",
        WebkitBackdropFilter: "blur(10px) saturate(1.5)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 16px 8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{t.rankingTitle}</div>
        </div>
        <button className="icon-btn" onClick={onToggle} title={t.rankingCollapse} style={{ width: 26, height: 26, fontSize: 14 }}>
          ›
        </button>
      </div>
      <div style={{ maxHeight: "max(140px, calc(100vh - 480px))", overflowY: "auto", padding: "0 8px 8px" }}>
        {top.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 11 }}>
            <div
              style={{
                width: 18,
                fontSize: 11.5,
                fontWeight: 700,
                color: i === 0 ? "var(--accent)" : "var(--text2)",
                fontVariantNumeric: "tabular-nums",
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "color-mix(in oklab, var(--accent) 9%, transparent)",
                border: "1px solid var(--line)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img src={r.thumbnailUrl} alt="" style={{ maxWidth: 26, maxHeight: 26, objectFit: "contain" }} loading="lazy" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                {r.nickname}
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent)",
                background: "color-mix(in oklab, var(--accent) 10%, transparent)",
                borderRadius: 999,
                padding: "3px 8px",
                flexShrink: 0,
              }}
            >
              {badgeLabel(r.hiddenMs)}
            </div>
          </div>
        ))}
        {top.length === 0 && (
          <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--text2)", fontSize: 12 }}>
            {t.rankingEmpty}
          </div>
        )}
      </div>
      <Link
        href="/history"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderTop: "1px solid var(--line)",
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--text2)",
          textDecoration: "none",
        }}
      >
        <span>{t.rankingHistoryLink}</span>
        <span>→</span>
      </Link>
    </div>
  );
}
