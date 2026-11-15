import { measureInk, minimumInkWidth } from "./ink-metrics";

/**
 * 그림을 회전한 뒤 잉크 영역만 잘라 정사각 PNG로 만든다 (브라우저 전용 — canvas 사용).
 *
 * 배치 프레임이 정사각이라 export도 정사각으로 맞춘다.
 * 회전을 여기서 이미지에 구워 넣기 때문에 서버는 평범한 투명 PNG 하나만 받는다
 * — 업로드 검증·타일 합성·발견 판정이 회전을 몰라도 그대로 동작한다.
 *
 * 항상 원본에서 다시 그리므로 회전을 여러 번 바꿔도 화질이 누적 열화되지 않는다.
 */

export interface InkSquare {
  /** 잉크를 정사각 캔버스 중앙에 담은 PNG data URL */
  url: string;
  /** 정사각 한 변 (px) */
  side: number;
  /** 불투명 픽셀 수 — 최소 잉크량 검증용 */
  ink: number;
  /** 회전과 무관하게 잉크 영역이 확보하는 최소 폭 (원본 px) */
  minWidth: number;
}

/**
 * @param deg 시계방향 회전각(도). 0이면 회전 없이 잉크만 잘라낸다.
 * @returns 잉크가 전혀 없으면 null
 */
export function toInkSquare(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  deg = 0,
): InkSquare | null {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  // 회전하면 외접 사각형이 커진다 — 모서리가 잘리지 않도록 캔버스를 그만큼 넓힌다
  const rw = Math.max(1, Math.ceil(srcW * cos + srcH * sin));
  const rh = Math.max(1, Math.ceil(srcW * sin + srcH * cos));

  const rot = document.createElement("canvas");
  rot.width = rw;
  rot.height = rh;
  const rc = rot.getContext("2d", { willReadFrequently: true });
  if (!rc) return null;
  rc.translate(rw / 2, rh / 2);
  rc.rotate(rad);
  rc.drawImage(src, -srcW / 2, -srcH / 2, srcW, srcH);

  // 알파 기준 잉크 영역 — 서버(app/api/drawings)와 같은 ALPHA_VISIBLE 기준을 쓴다
  const px = rc.getImageData(0, 0, rw, rh).data;
  const metrics = measureInk(px, rw, rh);
  if (!metrics) return null;
  const { left: minX, top: minY, width: bw, height: bh, ink } = metrics;
  const side = Math.max(bw, bh);

  const sq = document.createElement("canvas");
  sq.width = side;
  sq.height = side;
  const sc = sq.getContext("2d");
  if (!sc) return null;
  sc.drawImage(rot, minX, minY, bw, bh, Math.round((side - bw) / 2), Math.round((side - bh) / 2), bw, bh);

  return { url: sq.toDataURL("image/png"), side, ink, minWidth: minimumInkWidth(metrics) };
}
