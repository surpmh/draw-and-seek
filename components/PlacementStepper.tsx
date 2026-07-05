"use client";

import { useI18n } from "@/lib/i18n";

import type { Placing } from "@/lib/placement";
import { MIN_LONG, MAX_LONG, longSide } from "@/lib/placement";

/**
 * 업로드 STEP 2: 닉네임 입력 + 크기 슬라이더 + 배치 완료/취소.
 * 화면 상단 고정 카드.
 */
export function PlacementStepper({
  placing,
  nickname,
  onNickname,
  onResize,
  onComplete,
  onCancel,
  submitting,
}: {
  placing: Placing;
  nickname: string;
  onNickname: (v: string) => void;
  onResize: (long: number) => void;
  onComplete: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const { t } = useI18n();
  const canComplete = nickname.trim().length > 0 && !submitting;

  return (
    <div
      data-screen-label="Upload Step"
      style={{
        position: "fixed",
        top: "calc(68px + env(safe-area-inset-top))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        background: "var(--surface)",
        backdropFilter: "blur(22px) saturate(1.6)",
        WebkitBackdropFilter: "blur(22px) saturate(1.6)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        boxShadow: "var(--shadow)",
        padding: "14px 16px",
        width: "min(360px, calc(100vw - 24px))",
        animation: "fadeUp .35s cubic-bezier(.22,1,.36,1) both",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "var(--accent)",
            background: "color-mix(in oklab, var(--accent) 12%, transparent)",
            borderRadius: 999,
            padding: "3px 8px",
            letterSpacing: ".04em",
          }}
        >
          {t.stepBadge}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{t.stepTitle}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.55, marginBottom: 12 }}>
        {t.stepDesc}
      </div>

      {/* 닉네임 */}
      <label style={{ display: "block", fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>{t.nickname}</label>
      <input
        value={nickname}
        onChange={(e) => onNickname(e.target.value.slice(0, 7))}
        placeholder={t.nicknamePlaceholder}
        maxLength={7}
        style={{
          width: "100%",
          height: 34,
          borderRadius: 10,
          border: "1px solid var(--line)",
          background: "var(--solid)",
          color: "var(--text)",
          fontSize: 13,
          fontFamily: "inherit",
          padding: "0 12px",
          marginBottom: 12,
          outline: "none",
        }}
      />

      {/* 크기 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: "var(--text2)", flexShrink: 0 }}>{t.size}</span>
        <input
          type="range"
          min={MIN_LONG}
          max={MAX_LONG}
          value={longSide(placing)}
          onChange={(e) => onResize(+e.target.value)}
          style={{ flex: 1, accentColor: "var(--accent)", height: 22 }}
        />
        <span style={{ fontSize: 11, color: "var(--text2)", width: 54, textAlign: "right", flexShrink: 0 }}>
          {placing.w}×{placing.h}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          disabled={submitting}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "transparent",
            color: "var(--text)",
            fontSize: 12.5,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.5 : 1,
          }}
        >
          {t.cancel}
        </button>
        <button
          onClick={onComplete}
          disabled={!canComplete}
          style={{
            height: 34,
            padding: "0 16px",
            borderRadius: 10,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: canComplete ? "pointer" : "default",
            opacity: canComplete ? 1 : 0.5,
            boxShadow: "0 6px 18px color-mix(in oklab, var(--accent) 40%, transparent)",
          }}
        >
          {submitting ? t.submitting : t.complete}
        </button>
      </div>
    </div>
  );
}
