"use client";

import { useCallback, useRef, useState } from "react";
import type { Placing } from "@/lib/placement";
import { useI18n } from "@/lib/i18n";

/** 회전 핸들 지름·테두리와의 간격 (화면 px — scale 보정으로 줌과 무관하게 일정) */
const HANDLE = 30;
const HANDLE_GAP = 16;
/** 0°·±90°·180° 근처면 딱 맞춰 붙인다 */
const SNAP_DEG = 5;

/** [-180, 180) 범위로 정규화 */
const normDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

const snapDeg = (d: number) => {
  const r = Math.round(d / 90) * 90;
  return Math.abs(d - r) <= SNAP_DEG ? normDeg(r) : d;
};

/**
 * 배치 중인 그림의 미리보기. CanvasViewport의 월드 좌표계 안에 렌더된다.
 * 드래그로 위치를 옮긴다 (화면 이동량 ÷ scale = 월드 이동량).
 * 위쪽 핸들을 잡고 돌리면 프레임 중심 기준으로 회전한다 (더블클릭/더블탭 → 0°).
 */
export function PlacementOverlay({
  placing,
  scale,
  onMove,
  onRotate,
}: {
  placing: Placing;
  scale: number;
  onMove: (x: number, y: number) => void;
  onRotate: (deg: number) => void;
}) {
  const { t } = useI18n();
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const frameRef = useRef<HTMLDivElement>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    onMove(
      Math.round(d.px + (e.clientX - d.sx) / scaleRef.current),
      Math.round(d.py + (e.clientY - d.sy) / scaleRef.current),
    );
  }, [onMove]);

  const onPointerUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation(); // 뷰포트 팬 방지
      if (e.button !== 0) return;
      drag.current = { sx: e.clientX, sy: e.clientY, px: placing.x, py: placing.y };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [placing.x, placing.y, onPointerMove, onPointerUp],
  );

  // 회전: 잡은 순간의 (포인터 각도 − 현재 회전)을 유지해 핸들이 튀지 않게 한다
  const [rotating, setRotating] = useState(false);
  const rot = useRef<{ cx: number; cy: number; offset: number } | null>(null);

  const pointerDeg = (cx: number, cy: number, x: number, y: number) =>
    (Math.atan2(y - cy, x - cx) * 180) / Math.PI;

  const onRotateMove = useCallback((e: PointerEvent) => {
    const r = rot.current;
    if (!r) return;
    onRotate(Math.round(snapDeg(normDeg(pointerDeg(r.cx, r.cy, e.clientX, e.clientY) - r.offset))));
  }, [onRotate]);

  const onRotateUp = useCallback(() => {
    rot.current = null;
    setRotating(false);
    window.removeEventListener("pointermove", onRotateMove);
    window.removeEventListener("pointerup", onRotateUp);
  }, [onRotateMove]);

  const onHandleDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation(); // 프레임 이동·뷰포트 팬 방지
      if (e.button !== 0 || !frameRef.current) return;
      const b = frameRef.current.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      rot.current = { cx, cy, offset: pointerDeg(cx, cy, e.clientX, e.clientY) - placing.rotation };
      setRotating(true);
      window.addEventListener("pointermove", onRotateMove);
      window.addEventListener("pointerup", onRotateUp);
    },
    [placing.rotation, onRotateMove, onRotateUp],
  );

  const inset = 12 / scale;

  return (
    <div
      ref={frameRef}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: placing.x,
        top: placing.y,
        width: placing.w,
        height: placing.h,
        cursor: "grab",
        zIndex: 5,
        touchAction: "none",
      }}
    >
      {/* 점선 테두리 (scale 보정으로 항상 일정 두께) */}
      <div
        style={{
          position: "absolute",
          inset: -inset,
          border: `${2 / scale}px dashed var(--accent)`,
          borderRadius: 14 / scale,
          background: "color-mix(in oklab, var(--accent) 7%, transparent)",
        }}
      />
      <img
        src={placing.img}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", position: "relative", pointerEvents: "none" }}
      />

      {/* 회전 핸들: 테두리 위 가운데, 연결선 + 원형 버튼 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: `calc(100% + ${inset}px)`,
          width: 2 / scale,
          height: HANDLE_GAP / scale,
          marginLeft: -1 / scale,
          background: "var(--accent)",
          pointerEvents: "none",
        }}
      />
      <button
        type="button"
        aria-label={t.rotation}
        title={t.rotation}
        onPointerDown={onHandleDown}
        onDoubleClick={() => onRotate(0)}
        style={{
          position: "absolute",
          left: "50%",
          bottom: `calc(100% + ${inset + HANDLE_GAP / scale}px)`,
          width: HANDLE / scale,
          height: HANDLE / scale,
          marginLeft: -HANDLE / 2 / scale,
          padding: 0,
          borderRadius: "50%",
          border: `${2 / scale}px solid var(--accent)`,
          background: rotating ? "var(--accent)" : "var(--solid)",
          color: rotating ? "#fff" : "var(--accent)",
          boxShadow: `0 ${2 / scale}px ${8 / scale}px rgba(18, 24, 38, 0.18)`,
          display: "grid",
          placeItems: "center",
          cursor: rotating ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        <svg width={16 / scale} height={16 / scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v5h-5" />
        </svg>
      </button>

      {/* 돌리는 동안 각도 표시 */}
      {rotating && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: `calc(100% + ${inset + (HANDLE_GAP + HANDLE + 8) / scale}px)`,
            transform: "translateX(-50%)",
            padding: `${3 / scale}px ${8 / scale}px`,
            borderRadius: 999,
            background: "var(--text)",
            color: "var(--solid)",
            fontSize: 12 / scale,
            fontWeight: 700,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {placing.rotation}°
        </div>
      )}
    </div>
  );
}
