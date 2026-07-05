import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { readTilesetMeta, SERVE_DIR } from "@/lib/canvas-meta";

/**
 * 합성 타일 엔드포인트. 서빙본(serve/)을 그대로 스트리밍한다.
 * 합성은 쓰기(업로드/발견) 시점에 미리 수행되어 serve/에 기록돼 있다.
 *
 * URL의 ?v={version}이 캐시 키 역할을 하므로 응답은 immutable로 캐시한다.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await params;
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(y);
  if (!Number.isInteger(zi) || !Number.isInteger(xi) || !Number.isInteger(yi)) {
    return new NextResponse("bad tile coords", { status: 400 });
  }

  const meta = await readTilesetMeta();
  if (zi < 0 || zi > meta.maxZoom || xi < 0 || yi < 0) {
    return new NextResponse("tile out of range", { status: 404 });
  }

  const file = path.join(SERVE_DIR, String(zi), String(xi), `${yi}.webp`);
  try {
    const buf = await fs.readFile(file);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("tile not found", { status: 404 });
  }
}
