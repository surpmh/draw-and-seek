import { NextResponse } from "next/server";
import { readTilesetMeta, readCanvasStatus } from "@/lib/canvas-meta";

export async function GET() {
  const meta = await readTilesetMeta();
  const { version, remainCount } = await readCanvasStatus();
  // version은 그리기/찾기 직후 클라이언트 폴링(refreshUntilNewVersion)이 즉시 감지해야
  // 저장·발견한 그림이 새로고침 없이 화면에 반영된다. 캐싱하면 옛 version이 응답돼
  // 폴링이 변경을 놓치므로 절대 캐시하지 않는다.
  return NextResponse.json(
    { ...meta, version, remainCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
