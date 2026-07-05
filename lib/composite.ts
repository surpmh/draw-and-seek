import sharp from "sharp";
import { type TilesetMeta } from "./canvas-meta";
import { storageDownload, storageUpload } from "./storage";

/**
 * 쓰기 시점 타일 합성 (sharp).
 * 타일 원본/서빙본은 Supabase Storage에 저장 — 서버리스(Vercel)에서도 동작한다.
 */

const TILE = 512;

export interface DrawingRect {
  id: string;
  buf: Buffer; // 투명 PNG 원본
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TileKey {
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
 * @param unfound     현재 미발견 그림 전체 (각 타일에 겹치는 것만 골라 합성)
 */
export async function recompositeTiles(
  tiles: TileKey[],
  unfound: DrawingRect[],
  meta: TilesetMeta,
): Promise<void> {
  // 그림별 축소본 캐시 (레벨별로 크기가 다르므로 z 포함 키)
  const resizedCache = new Map<string, Buffer>();

  const resizeDrawing = async (d: DrawingRect, f: number): Promise<{ buf: Buffer; rw: number; rh: number }> => {
    const rw = Math.max(1, Math.round(d.w / f));
    const rh = Math.max(1, Math.round(d.h / f));
    const key = `${d.id}@${rw}x${rh}`;
    let buf = resizedCache.get(key);
    if (!buf) {
      buf = await sharp(d.buf).resize(rw, rh, { fit: "fill" }).png().toBuffer();
      resizedCache.set(key, buf);
    }
    return { buf, rw, rh };
  };

  // Storage 왕복(다운로드+업로드)이 타일당 수백 ms — 서버리스 시간 제한 안에 끝나도록 병렬 처리
  await Promise.all(tiles.map(async (t) => {
    const f = worldPerPx(t.z, meta.maxZoom);
    const tileLeft = t.tx * TILE * f;
    const tileTop = t.ty * TILE * f;
    const tileRight = tileLeft + TILE * f;
    const tileBottom = tileTop + TILE * f;

    const baseBuf = await storageDownload(`tiles/base/${t.z}/${t.tx}/${t.ty}.webp`);
    if (!baseBuf) return; // base 없으면 스킵 (범위 밖)
    const base = sharp(baseBuf);
    const meta0 = await base.metadata();
    const tileW = meta0.width ?? TILE;
    const tileH = meta0.height ?? TILE;

    const overlays: sharp.OverlayOptions[] = [];
    for (const d of unfound) {
      // 월드 겹침 판정
      if (d.x + d.w <= tileLeft || d.x >= tileRight || d.y + d.h <= tileTop || d.y >= tileBottom) {
        continue;
      }
      const { buf, rw, rh } = await resizeDrawing(d, f);
      // 타일 픽셀 공간에서 그림의 좌상단
      const ox = (d.x - tileLeft) / f;
      const oy = (d.y - tileTop) / f;
      // 타일과의 교집합 (타일 픽셀 좌표)
      const ix0 = Math.max(0, Math.floor(ox));
      const iy0 = Math.max(0, Math.floor(oy));
      const ix1 = Math.min(tileW, Math.ceil(ox + rw));
      const iy1 = Math.min(tileH, Math.ceil(oy + rh));
      const cw = ix1 - ix0;
      const ch = iy1 - iy0;
      if (cw <= 0 || ch <= 0) continue;
      // 축소본에서 잘라낼 영역
      const sx = Math.min(rw - 1, Math.max(0, ix0 - Math.round(ox)));
      const sy = Math.min(rh - 1, Math.max(0, iy0 - Math.round(oy)));
      const ecw = Math.min(cw, rw - sx);
      const ech = Math.min(ch, rh - sy);
      if (ecw <= 0 || ech <= 0) continue;
      const crop = await sharp(buf).extract({ left: sx, top: sy, width: ecw, height: ech }).png().toBuffer();
      overlays.push({ input: crop, left: ix0, top: iy0 });
    }

    const out = await base.composite(overlays).webp({ quality: 95 }).toBuffer();
    await storageUpload(`tiles/serve/${t.z}/${t.tx}/${t.ty}.webp`, out, "image/webp");
  }));
}
