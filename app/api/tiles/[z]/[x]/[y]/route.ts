import { NextResponse } from "next/server";
import { readTilesetMeta } from "@/lib/canvas-meta";
import { storageDownload } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * 합성 타일 엔드포인트. Storage의 서빙본(tiles/serve/)을 그대로 스트리밍한다.
 * 합성은 쓰기(업로드/발견) 시점에 미리 수행되어 있다.
 *
 * URL의 ?v={version}이 캐시 키 역할을 하므로 응답은 immutable로 캐시한다
 * — Vercel CDN이 이 헤더를 보고 엣지에 캐시해 Storage 왕복은 타일당 최초 1회뿐.
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

  const buf = await storageDownload(`tiles/serve/${zi}/${xi}/${yi}.webp`);
  if (!buf) return new NextResponse("tile not found", { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
