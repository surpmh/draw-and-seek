import fs from "node:fs/promises";
import path from "node:path";
import { DRAWINGS_DIR } from "./canvas-meta";
import type { DrawingRect } from "./composite";

export interface DrawingRow {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  image_path: string;
}

export async function saveDrawingPng(id: string, buf: Buffer): Promise<string> {
  await fs.mkdir(DRAWINGS_DIR, { recursive: true });
  const rel = `${id}.png`;
  await fs.writeFile(path.join(DRAWINGS_DIR, rel), buf);
  return rel;
}

export async function loadDrawingRects(rows: DrawingRow[]): Promise<DrawingRect[]> {
  const out: DrawingRect[] = [];
  for (const r of rows) {
    try {
      const buf = await fs.readFile(path.join(DRAWINGS_DIR, r.image_path));
      out.push({ id: r.id, buf, x: r.x, y: r.y, w: r.w, h: r.h });
    } catch {
      // 파일 누락 시 스킵 (그림 없이 합성)
    }
  }
  return out;
}
