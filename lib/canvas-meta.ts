import fs from "node:fs/promises";
import path from "node:path";

export const TILES_DIR = path.join(process.cwd(), "data", "tiles");
export const BASE_DIR = path.join(TILES_DIR, "base");
export const SERVE_DIR = path.join(TILES_DIR, "serve");
export const DRAWINGS_DIR = path.join(process.cwd(), "data", "drawings");

export interface TilesetMeta {
  width: number;
  height: number;
  tileSize: number;
  maxZoom: number;
}

let cached: TilesetMeta | null = null;

export async function readTilesetMeta(): Promise<TilesetMeta> {
  if (cached) return cached;
  const raw = await fs.readFile(path.join(TILES_DIR, "meta.json"), "utf8");
  cached = JSON.parse(raw) as TilesetMeta;
  return cached;
}

/**
 * 캔버스 전역 버전 + 미발견 그림 수.
 * Supabase에서 읽되, DB 미구성 시엔 안전한 기본값으로 폴백해 타일은 계속 뜨게 한다.
 */
export async function readCanvasStatus(): Promise<{ version: number; remainCount: number }> {
  try {
    const { getServiceClient } = await import("./supabase");
    const db = getServiceClient();
    const [{ data: c }, { count }] = await Promise.all([
      db.from("canvas").select("version").eq("id", 1).maybeSingle(),
      db.from("drawings").select("id", { count: "exact", head: true }).is("found_at", null),
    ]);
    return { version: Number(c?.version ?? 1), remainCount: count ?? 0 };
  } catch {
    return { version: 1, remainCount: 0 };
  }
}
