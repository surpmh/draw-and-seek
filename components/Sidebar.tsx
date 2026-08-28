"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ReportModal, type ReportTarget } from "./ReportModal";

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
/** 썸네일 → 정보 카드로 마우스가 건너가는 사이 카드가 닫히지 않게 두는 유예 */
const CARD_CLOSE_MS = 180;

/**
 * 화면 좌측에 떠 있는 Hidden Drawings 스트립 — 찾아야 할 그림 썸네일만 세로로 나열.
 * hover(마우스)·탭(터치) 시 옆에 정보 카드를 띄운다. 캔버스는 뒤로 꽉 찬다.
 * compact: 모바일용 축소판 — 앱바 아래에서 시작하고 하단 액션 필을 침범하지 않는다.
 */
export const Sidebar = memo(function Sidebar({
  items,
  hidden,
  compact,
}: {
  items: DrawingItem[];
  hidden?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const stripW = compact ? 52 : STRIP_W;
  const stripLeft = compact ? 8 : 16;
  const [info, setInfo] = useState<{ it: DrawingItem; y: number } | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenLabel = (ms: number) => {
    const days = Math.floor(ms / 86400_000);
    if (days >= 1) return t.hiddenForDays(days);
    const hours = Math.floor(ms / 3600_000);
    if (hours >= 1) return t.hiddenForHours(hours);
    return t.justHidden;
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setInfo(null), CARD_CLOSE_MS);
  };
  useEffect(() => cancelClose, []);

  if (hidden || items.length === 0) return null;

  const showInfo = (it: DrawingItem, el: HTMLElement) => {
    cancelClose();
    const r = el.getBoundingClientRect();
    // 카드가 화면 아래로 잘리지 않게 상단 좌표를 제한 (신고 버튼까지 들어간 높이 기준)
    setInfo({ it, y: Math.min(r.top, window.innerHeight - 132) });
  };

  return (
    <>
    <aside
      data-screen-label="Hidden Drawings Strip"
      style={{
        position: "fixed",
        left: stripLeft,
        top: compact ? "calc(66px + env(safe-area-inset-top))" : 68,
        // compact(모바일)는 하단 액션 필(≈72px + safe-area)을 침범하지 않게 제한
        maxHeight: compact
          ? "calc(100dvh - 150px - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
          : "calc(100vh - 100px)",
        width: stripW,
        zIndex: 35,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        backdropFilter: "blur(10px) saturate(1.5)",
        WebkitBackdropFilter: "blur(10px) saturate(1.5)",
        border: "1px solid var(--line)",
        borderRadius: compact ? 14 : 16,
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          overflowY: "auto",
          padding: compact ? 6 : 8,
          display: "flex",
          flexDirection: "column",
          gap: compact ? 6 : 8,
        }}
        onMouseLeave={scheduleClose}
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
              borderRadius: compact ? 9 : 11,
              background: "color-mix(in oklab, var(--accent) 9%, transparent)",
              border: "1px solid var(--line)",
              boxShadow: it.isMine ? "0 0 0 2px var(--accent)" : undefined,
              overflow: "hidden",
              padding: 4,
              cursor: "pointer",
            }}
          >
            {/* %-max는 grid auto 트랙에서 원본 크기로 트랙을 키워 잘린다 — 명시적 100% 채움 + contain */}
            <img
              src={it.thumbnailUrl}
              alt=""
              style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
              loading="lazy"
            />
          </button>
        ))}
      </div>

    </aside>

    {/* hover·탭한 그림의 정보 카드 — 스트립 오른쪽에 뜬다.
        aside 밖에 둔다: aside의 backdrop-filter가 fixed 자손의 컨테이닝 블록이 되어
        overflow:hidden에 카드가 잘려버린다.
        신고 버튼을 담으므로 클릭을 받아야 한다 — 유예 타이머로 썸네일→카드 hover 이동을 허용한다. */}
    {info && (
      <div
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        style={{
          position: "fixed",
          left: stripLeft + stripW + 10,
          top: info.y,
          zIndex: 45,
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

        {/* 내 그림은 신고 대상이 아니다 */}
        {!info.it.isMine && (
          <button
            onClick={() => {
              setReportTarget({ id: info.it.id, nickname: info.it.nickname, thumbnailUrl: info.it.thumbnailUrl });
              setInfo(null);
            }}
            style={{
              marginTop: 8,
              width: "100%",
              height: 30,
              borderRadius: 9,
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--text2)",
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            🚩 {t.report}
          </button>
        )}
      </div>
    )}

    <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </>
  );
});
