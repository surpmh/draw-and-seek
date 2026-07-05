import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Locate Me — 내(device) 미발견 그림 중 가장 최근 것의 좌표.
 * 본인 그림에 한해서만 좌표를 내려준다.
 */
export async function GET(req: Request) {
  const deviceId = req.headers.get("x-device-id");
  if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
    return new NextResponse("device id가 없습니다", { status: 400 });
  }
  const db = getServiceClient();
  const { data, error } = await db
    .from("drawings")
    .select("x, y, w, h")
    .eq("device_id", deviceId)
    .is("found_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return new NextResponse(`DB 오류: ${error.message}`, { status: 500 });
  if (!data) return NextResponse.json({ mine: null });
  return NextResponse.json(
    { mine: { cx: data.x + data.w / 2, cy: data.y + data.h / 2 } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
