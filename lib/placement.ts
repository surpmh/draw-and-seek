import type { CanvasMeta } from "./tiles";

/** 배치 그림 크기 (월드 좌표) — 정사각형, 한 변 기준. WYSIWYG: 그린 크기 미만이면 반려(확대 금지) */
export const MIN_LONG = 48;
export const MAX_LONG = 128;
/** 배치 기본 크기 (정사각 한 변) */
export const DEFAULT_LONG = 96;

/** 업로드 검증(클라이언트 사전 검사·서버 공용): 투명 여백을 제거한 실제 그림 영역의 최소 긴 변 (월드 px) */
export const MIN_TRIMMED_LONG = 48;
/** 업로드 검증(클라이언트 사전 검사·서버 공용): 월드 좌표 기준 최소 잉크 면적(px²) */
export const MIN_INK_WORLD = 30;
/** 업로드 검증(클라이언트 사전 검사·서버 공용): 잉크로 인정하는 최소 알파 — find 히트테스트와 동일 기준 */
export const ALPHA_VISIBLE = 32;

export interface Placing {
  img: string; // data URL (투명 PNG)
  x: number; // 월드 좌표 (좌상단)
  y: number;
  w: number;
  h: number;
  aspect: number; // w/h 원본 비율
}

/** 초기 배치 크기 — 항상 기본 정사각 (그림은 정사각 export로 만들어져 옴) */
export function initialSize(): { w: number; h: number; aspect: number } {
  return { w: DEFAULT_LONG, h: DEFAULT_LONG, aspect: 1 };
}

/** 슬라이더 값에 맞춰 정사각 한 변 재계산 */
export function sizeFromLong(long: number, _aspect?: number): { w: number; h: number } {
  const side = Math.round(Math.min(MAX_LONG, Math.max(MIN_LONG, long)));
  return { w: side, h: side };
}

export const longSide = (p: Pick<Placing, "w" | "h">) => Math.max(p.w, p.h);

/** 그림 전체가 캔버스 내부에 있도록 좌표를 보정 */
export function clampToCanvas(p: Placing, meta: CanvasMeta): Placing {
  const x = Math.min(meta.width - p.w, Math.max(0, p.x));
  const y = Math.min(meta.height - p.h, Math.max(0, p.y));
  return { ...p, x: Math.round(x), y: Math.round(y) };
}
