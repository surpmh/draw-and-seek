import { after, NextResponse } from "next/server";
import { readTilesetMeta } from "@/lib/canvas-meta";
import { storageDownloadFresh } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * 합성 타일 엔드포인트. Storage의 서빙본(tiles/serve/)을 그대로 스트리밍한다.
 * 합성은 쓰기(업로드/발견) 시점에 미리 수행되어 있다.
 *
 * URL의 ?v={version}이 캐시 키 역할을 하므로 응답은 immutable로 캐시한다
 * Cloudflare Cache API에 버전을 포함한 URL을 키로 저장해 Storage 왕복을 줄인다.
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

  const cache = typeof caches !== "undefined" ? await caches.open("drawandseek-tiles") : null;
  const cached = cache ? await cache.match(_req) : undefined;
  if (cached) return cached;

  const meta = await readTilesetMeta();
  if (zi < 0 || zi > meta.maxZoom || xi < 0 || yi < 0) {
    return new NextResponse("tile out of range", { status: 404 });
  }

  // 서빙본은 재합성 때마다 같은 키로 덮어쓴다. CDN 캐시본(옛 타일)을 받으면 그게
  // 새 ?v= 아래 immutable로 굳어 다음 버전까지 그림이 안 보이므로 반드시 원본을 읽는다.
  const buf = await storageDownloadFresh(`tiles/serve/${zi}/${xi}/${yi}.webp`);
  if (!buf) return new NextResponse("tile not found", { status: 404 });
  const response = new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  if (cache) {
    const copy = response.clone();
    after(() => cache.put(_req, copy));
  }
  return response;
}
