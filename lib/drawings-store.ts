import { storageDownload, storageUpload } from "./storage";
import type { DrawingRect } from "./composite";

export interface DrawingRow {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  image_path: string;
}

/** DB의 image_path(`{id}.png`) → Storage 키 */
const drawingKey = (imagePath: string) => `drawings/${imagePath}`;

export async function saveDrawingPng(id: string, buf: Buffer): Promise<string> {
  const rel = `${id}.png`;
  await storageUpload(drawingKey(rel), buf, "image/png");
  return rel;
}

export async function loadDrawingPng(imagePath: string): Promise<Buffer | null> {
  return storageDownload(drawingKey(imagePath));
}

export async function loadDrawingRects(rows: DrawingRow[]): Promise<DrawingRect[]> {
  const loaded = await Promise.all(
    rows.map(async (r) => {
      const buf = await storageDownload(drawingKey(r.image_path));
      // 파일 누락 시 스킵 (그림 없이 합성)
      return buf ? { id: r.id, buf, x: r.x, y: r.y, w: r.w, h: r.h } : null;
    }),
  );
  return loaded.filter((d): d is DrawingRect => d !== null);
}
