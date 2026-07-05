"use client";

import type { CanvasMeta } from "@/lib/tiles";
import type { Viewport } from "@/lib/useViewport";
import { TileLayer } from "./TileLayer";

export function CanvasViewport({
  meta,
  viewport,
  children,
  cursor,
  leftInset = 0,
  topInset = 0,
}: {
  meta: CanvasMeta;
  viewport: Viewport;
  children?: React.ReactNode;
  /** 도구 모드에 따른 커서 override (예: 스포이드) */
  cursor?: string;
  /** 사이드바 등 고정 UI에 가려지지 않도록 뷰포트 왼쪽을 밀어주는 값 */
  leftInset?: number;
  /** 탑 네비게이션에 가려지지 않도록 뷰포트 위쪽을 밀어주는 값 */
  topInset?: number;
}) {
  const { elRef, transformRef, view, size, panning, animating, onPointerDown, onDoubleClick } = viewport;

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      data-screen-label="Canvas"
      style={{
        position: "absolute",
        top: topInset,
        right: 0,
        bottom: 0,
        left: leftInset,
        overflow: "hidden",
        touchAction: "none",
        cursor: cursor ?? (panning ? "grabbing" : "grab"),
      }}
    >
      <div
        ref={transformRef /* 제스처 중엔 useViewport가 여기에 transform을 직접 쓴다 (React 우회) */}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: meta.width,
          height: meta.height,
          transformOrigin: "0 0",
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
          transition: animating ? "transform .52s cubic-bezier(.22,1,.36,1)" : "none",
          willChange: "transform",
          backgroundColor: "var(--canvas)",
          overflow: "hidden",
        }}
      >
        <TileLayer view={view} size={size} meta={meta} gesturing={panning} />
        {children /* M2: 배치 미리보기 오버레이가 여기에 들어감 */}
      </div>
    </div>
  );
}
