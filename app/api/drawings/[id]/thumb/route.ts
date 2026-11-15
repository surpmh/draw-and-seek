import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { storageDownload } from "@/lib/storage";
import { imageService } from "@/lib/image-service";

export const runtime = "nodejs";

/**
 * 사이드바/랭킹용 축소 썸네일.
 * 원본 해상도를 노출하지 않도록 최대 96px로만 서빙한다 (템플릿 매칭 치팅 완화).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("bad id", { status: 400 });

  const db = getServiceClient();
  const { data } = await db.from("drawings").select("image_path, removed_at").eq("id", id).maybeSingle();
  // 관리자 제재 그림은 id를 알아도 서빙하지 않는다
  if (!data || data.removed_at) return new NextResponse("not found", { status: 404 });

  // 새 그림은 저장 시 썸네일을 만든다. 이전 그림은 최초 요청에서 생성한다.
  let thumb: Uint8Array | null = await storageDownload(`thumbnails/${data.image_path.replace(/\.png$/, ".webp")}`);
  if (!thumb) {
    try {
      const response = await imageService("thumbnail", JSON.stringify({ imagePath: data.image_path }));
      thumb = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      console.error("thumbnail generation failed:", error);
      return new NextResponse("이미지를 불러오지 못했어요", { status: 502 });
    }
  }
  return new NextResponse(new Uint8Array(thumb), {
    headers: {
      "Content-Type": "image/webp",
      // 삭제 여부를 매번 확인해야 하므로 공개 응답을 장기 캐시하지 않는다.
      "Cache-Control": "no-store",
    },
  });
}
