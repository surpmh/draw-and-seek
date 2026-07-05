"use client";

import { memo, useState } from "react";
import { useI18n } from "@/lib/i18n";

export interface DrawingItem {
  id: string;
  nickname: string;
  /** 숨겨진 뒤 경과 시간 (밀리초) — 정밀 정렬·표시용 */
  hiddenMs: number;
  thumbnailUrl: string;
  isMine: boolean;
}



/** 썸네일 스트립 폭 — 정보 카드 위치 계산과 공유 */
const STRIP_W = 76;

/**
 * 화면 좌측에 떠 있는 Hidden Drawings 스트립 — 찾아야 할 그림 썸네일만 세로로 나열.
 * hover(마우스)·탭(터치) 시 옆에 정보 카드를 띄운다. 캔버스는 뒤로 꽉 찬다.
 */
export const Sidebar = memo(function Sidebar({ items, hidden }: { items: DrawingItem[]; hidden?: boolean }) {
  const { t } = useI18n();
  const [info, setInfo] = useState<{ it: DrawingItem; y: number } | null>(null);
  const hiddenLabel = (ms: number) => {
    const days = Math.floor(ms / 86400_000);
    if (days >= 1) return t.hiddenForDays(days);
    const hours = Math.floor(ms / 3600_000);
    if (hours >= 1) return t.hiddenForHours(hours);
    return t.justHidden;
  };

  if (hidden || items.length === 0) return null;

  const showInfo = (it: DrawingItem, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setInfo({ it, y: Math.min(r.top, window.innerHeight - 84) });
  };

  return (
    <aside
      data-screen-label="Hidden Drawings Strip"
      style={{
        position: "fixed",
        left: 16,
        top: 68,
        maxHeight: "calc(100vh - 100px)",
        width: STRIP_W,
        zIndex: 35,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        backdropFilter: "blur(10px) saturate(1.5)",
        WebkitBackdropFilter: "blur(10px) saturate(1.5)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          overflowY: "auto",
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
        onMouseLeave={() => setInfo(null)}
      >
        {items.map((it) => (
          <button
            key={it.id}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") showInfo(it, e.currentTarget);
            }}
            onPointerUp={(e) => {
              // 터치는 hover가 없으므로 탭으로 토글 (마우스는 hover가 담당)
              if (e.pointerType !== "mouse") {
                if (info?.it.id === it.id) setInfo(null);
                else showInfo(it, e.currentTarget);
              }
            }}
            style={{
              aspectRatio: "1",
              flexShrink: 0,
              borderRadius: 11,
              background: "color-mix(in oklab, var(--accent) 9%, transparent)",
              border: "1px solid var(--line)",
              boxShadow: it.isMine ? "0 0 0 2px var(--accent)" : undefined,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              padding: 4,
              cursor: "pointer",
            }}
          >
            <img
              src={it.thumbnailUrl}
              alt=""
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* hover·탭한 그림의 정보 카드 — 스트립 오른쪽에 뜬다 */}
      {info && (
        <div
          style={{
            position: "fixed",
            left: 16 + STRIP_W + 10,
            top: info.y,
            zIndex: 45,
            pointerEvents: "none",
            background: "var(--solid)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            boxShadow: "var(--shadow)",
            padding: "9px 13px",
            animation: "popIn .18s ease both",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
            by {info.it.nickname}
            {info.it.isMine && (
              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>{t.myDrawing}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{hiddenLabel(info.it.hiddenMs)}</div>
        </div>
      )}
    </aside>
  );
});
