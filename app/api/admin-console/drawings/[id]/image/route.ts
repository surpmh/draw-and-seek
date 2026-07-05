import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { loadDrawingPng } from "@/lib/drawings-store";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * 관리자 전용: 원본 해상도 이미지.
 * 공개 썸네일(96px 제한)과 달리 부적절 여부를 판별할 수 있게 원본을 그대로 서빙한다.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) return new NextResponse("인증이 필요합니다", { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("bad id", { status: 400 });

  const db = getServiceClient();
  const { data } = await db.from("drawings").select("image_path").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("not found", { status: 404 });

  const buf = await loadDrawingPng(data.image_path);
  if (!buf) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
