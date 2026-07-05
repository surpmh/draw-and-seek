export const TILE_SIZE = 512;

export interface CanvasMeta {
  width: number;
  height: number;
  tileSize: number;
  maxZoom: number;
  version: number;
  remainCount: number;
}

export interface View {
  x: number;
  y: number;
  s: number;
}

export interface TileSpec {
  z: number;
  tx: number;
  ty: number;
  /** 월드 좌표 기준 배치 */
  left: number;
  top: number;
  w: number;
  h: number;
}

/** 화면 배율 s에서 업스케일 블러 없이 표시할 수 있는 최소 상세도의 레벨 */
export function levelForScale(s: number, maxZoom: number): number {
  const z = maxZoom + Math.floor(Math.log2(s) + 1e-9);
  return Math.max(0, Math.min(maxZoom, z));
}

/** 레벨 z의 픽셀 1개가 차지하는 월드 픽셀 수 */
export function worldPerLevelPx(z: number, maxZoom: number): number {
  return 2 ** (maxZoom - z);
}

export function tileCounts(meta: Pick<CanvasMeta, "width" | "height" | "tileSize">, f: number) {
  return {
    tilesX: Math.ceil(meta.width / (meta.tileSize * f)),
    tilesY: Math.ceil(meta.height / (meta.tileSize * f)),
  };
}

/** 현재 뷰포트에 보이는 타일 목록 (월드 배치 좌표 포함). z를 넘기면 해당 레벨로 고정 */
export function visibleTiles(
  view: View,
  vw: number,
  vh: number,
  meta: CanvasMeta,
  z = levelForScale(view.s, meta.maxZoom),
): TileSpec[] {
  const f = worldPerLevelPx(z, meta.maxZoom);
  const span = meta.tileSize * f; // 타일 하나의 월드 크기
  const { tilesX, tilesY } = tileCounts(meta, f);

  const wx0 = -view.x / view.s;
  const wy0 = -view.y / view.s;
  const wx1 = (vw - view.x) / view.s;
  const wy1 = (vh - view.y) / view.s;

  const tx0 = Math.max(0, Math.floor(wx0 / span));
  const ty0 = Math.max(0, Math.floor(wy0 / span));
  const tx1 = Math.min(tilesX - 1, Math.floor(wx1 / span));
  const ty1 = Math.min(tilesY - 1, Math.floor(wy1 / span));

  const out: TileSpec[] = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const left = tx * span;
      const top = ty * span;
      out.push({
        z,
        tx,
        ty,
        left,
        top,
        w: Math.min(span, meta.width - left),
        h: Math.min(span, meta.height - top),
      });
    }
  }
  return out;
}
