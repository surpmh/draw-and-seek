"use client";

import { useCallback, useRef } from "react";
import type { Placing } from "@/lib/placement";

/**
 * 배치 중인 그림의 미리보기. CanvasViewport의 월드 좌표계 안에 렌더된다.
 * 드래그로 위치를 옮긴다 (화면 이동량 ÷ scale = 월드 이동량).
 */
export function PlacementOverlay({
  placing,
  scale,
  onMove,
}: {
  placing: Placing;
  scale: number;
  onMove: (x: number, y: number) => void;
}) {
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

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

  return (
    <div
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
          inset: -12 / scale,
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
    </div>
  );
}
