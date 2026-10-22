import type { CanvasMeta } from "./tiles";

/** 배치 그림 크기 (월드 좌표) — 정사각형, 한 변 기준. WYSIWYG: 그린 크기 미만이면 반려(확대 금지) */
export const MIN_LONG = 48;
export const MAX_LONG = 128;

/** 업로드 검증(클라이언트 사전 검사·서버 공용): 투명 여백을 제거한 실제 그림 영역의 최소 긴 변 (월드 px) */
export const MIN_TRIMMED_LONG = 48;
/** 업로드 검증(클라이언트 사전 검사·서버 공용): 월드 좌표 기준 최소 잉크 면적(px²) */
export const MIN_INK_WORLD = 30;
/** 업로드 검증(클라이언트 사전 검사·서버 공용): 잉크로 인정하는 최소 알파 — find 히트테스트와 동일 기준 */
export const ALPHA_VISIBLE = 32;

export interface Placing {
  img: string; // data URL (투명 PNG) — 회전이 이미 반영된 결과물
  x: number; // 월드 좌표 (좌상단)
  y: number;
  w: number;
  h: number;
  /**
   * 시계방향 회전각(도). 미리보기 이미지에 이미 구워져 있으므로 서버로 보내지 않는다.
   * 슬라이더 값을 유지하고 원본에서 다시 굽기 위해서만 들고 있는다.
   */
  rotation: number;
}

/** 회전 슬라이더 범위 (도) */
export const MIN_ROTATION = -180;
export const MAX_ROTATION = 180;

/** 슬라이더 값에 맞춰 정사각 한 변 재계산 */
export function sizeFromLong(long: number): { w: number; h: number } {
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
