"use client";

import { useI18n } from "@/lib/i18n";

export interface FoundAnim {
  sx: number; // 스크린 좌표
  sy: number;
  nickname: string;
  hiddenMs: number;
}



export function FoundAnimation({ anim }: { anim: FoundAnim }) {
  const { t } = useI18n();
  const days = Math.floor(anim.hiddenMs / 86400_000);
  const hours = Math.floor(anim.hiddenMs / 3600_000);
  const after = days >= 1 ? t.badgeDays(days) : hours >= 1 ? t.badgeHours(hours) : null;
  return (
    <div style={{ position: "fixed", left: anim.sx, top: anim.sy, zIndex: 70, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 45%, transparent), transparent 68%)",
          animation: "glowPulse 1.15s ease-out infinite",
        }}
      />
      <div style={{ position: "absolute", left: 0, top: -16, transform: "translate(-50%,-100%)" }}>
        <div
          style={{
            background: "var(--surface)",
            backdropFilter: "blur(16px) saturate(1.5)",
            WebkitBackdropFilter: "blur(16px) saturate(1.5)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
            borderRadius: 999,
            padding: "9px 16px",
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            color: "var(--text)",
            animation: "popIn .5s cubic-bezier(.3,1.4,.5,1) both",
          }}
        >
          {t.foundBanner(anim.nickname)}
          {after && <span style={{ color: "var(--text2)", fontWeight: 500 }}>{t.foundAfter(after)}</span>}
        </div>
      </div>
    </div>
  );
}

/** 미스 클릭 시 잔잔한 파문 */
export function MissRipple({ sx, sy }: { sx: number; sy: number }) {
  return (
    <div style={{ position: "fixed", left: sx, top: sy, zIndex: 70, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "2px solid color-mix(in oklab, var(--text) 30%, transparent)",
          animation: "glowPulse .6s ease-out both",
        }}
      />
    </div>
  );
}
