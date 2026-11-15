import { imageService } from "./image-service";
import { type TilesetMeta } from "./canvas-meta";

/**
 * Worker는 타일 좌표만 계산한다. 이미지 처리는 무료 Supabase Edge Function에서 수행한다.
 * 타일 원본과 합성본은 기존 Supabase Storage를 그대로 사용한다.
 */

const TILE = 512;

export interface DrawingRect {
  id: string;
  image_path: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileKey {
  z: number;
  tx: number;
  ty: number;
}

const worldPerPx = (z: number, maxZoom: number) => 2 ** (maxZoom - z);

/** bbox(월드)와 겹치는 모든 줌 레벨의 타일 목록 */
export function tilesForBbox(
  bbox: { x: number; y: number; w: number; h: number },
  meta: TilesetMeta,
): TileKey[] {
  const out: TileKey[] = [];
  for (let z = 0; z <= meta.maxZoom; z++) {
    const f = worldPerPx(z, meta.maxZoom);
    const span = TILE * f;
    const lw = Math.max(1, Math.round(meta.width / f));
    const lh = Math.max(1, Math.round(meta.height / f));
    const tilesX = Math.ceil(lw / TILE);
    const tilesY = Math.ceil(lh / TILE);
    const tx0 = Math.max(0, Math.floor(bbox.x / span));
    const ty0 = Math.max(0, Math.floor(bbox.y / span));
    const tx1 = Math.min(tilesX - 1, Math.floor((bbox.x + bbox.w - 1) / span));
    const ty1 = Math.min(tilesY - 1, Math.floor((bbox.y + bbox.h - 1) / span));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) out.push({ z, tx, ty });
    }
  }
  return out;
}

/** 여러 그림 bbox의 합집합에 해당하는 타일 (중복 제거) */
export function tilesForDrawings(drawings: DrawingRect[], meta: TilesetMeta): TileKey[] {
  const seen = new Map<string, TileKey>();
  for (const d of drawings) {
    for (const t of tilesForBbox(d, meta)) seen.set(`${t.z}/${t.tx}/${t.ty}`, t);
  }
  return [...seen.values()];
}

/**
 * 주어진 타일들을 base에서 다시 합성한다 (겹치는 미발견 그림 전부를 알파 블렌딩).
 * @param tiles       재합성할 타일
 * @param unfound     현재 미발견 그림 목록 (PNG는 Edge Function에서 읽는다)
 */
export async function recompositeTiles(
  tiles: TileKey[],
  unfound: DrawingRect[],
  meta: TilesetMeta,
): Promise<void> {
  // Each invocation processes one tile within Supabase Free's 2s CPU budget.
  // Bound concurrency to avoid overwhelming storage and the six-connection Worker limit.
  for (let i = 0; i < tiles.length; i += 4) {
    await Promise.all(tiles.slice(i, i + 4).map(async (tile) => {
      const f = worldPerPx(tile.z, meta.maxZoom);
      const left = tile.tx * TILE * f, top = tile.ty * TILE * f;
      const drawings = unfound.filter((d) =>
        d.x + d.w > left && d.x < left + TILE * f && d.y + d.h > top && d.y < top + TILE * f,
      );
      const response = await imageService("tile", JSON.stringify({ tile, drawings, meta }));
      await response.json();
    }));
  }
}
