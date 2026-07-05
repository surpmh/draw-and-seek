import { NextResponse } from "next/server";
import { readTilesetMeta, readCanvasStatus } from "@/lib/canvas-meta";

export async function GET() {
  const meta = await readTilesetMeta();
  const { version, remainCount } = await readCanvasStatus();
  return NextResponse.json(
    { ...meta, version, remainCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
