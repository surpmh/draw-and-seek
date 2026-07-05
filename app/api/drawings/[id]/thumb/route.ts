import { NextResponse } from "next/server";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { getServiceClient } from "@/lib/supabase";
import { DRAWINGS_DIR } from "@/lib/canvas-meta";

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

  try {
    const buf = await fs.readFile(path.join(DRAWINGS_DIR, data.image_path));
    const thumb = await sharp(buf)
      .resize(96, 96, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return new NextResponse(new Uint8Array(thumb), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
