import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { getServiceClient } from "@/lib/supabase";
import { readTilesetMeta } from "@/lib/canvas-meta";
import { recompositeTiles, tilesForBbox } from "@/lib/composite";
import { saveDrawingPng, loadDrawingRects, type DrawingRow } from "@/lib/drawings-store";
import { MAX_LONG, MIN_TRIMMED_LONG, MIN_INK_WORLD, ALPHA_VISIBLE } from "@/lib/placement";

export const runtime = "nodejs";
export const maxDuration = 60; // 타일 재합성(Storage 왕복 다수)이 기본 제한을 넘을 수 있음

/**
 * 미발견 그림 목록 — 좌표는 절대 포함하지 않는다.
 * 사이드바(전체)와 랭킹(오래된 순 Top 10)이 이 응답 하나로 파생된다.
 */
export async function GET(req: Request) {
  const deviceId = req.headers.get("x-device-id") ?? "";
  const db = getServiceClient();
  const { data, error } = await db
    .from("drawings")
    .select("id, nickname, device_id, created_at")
    .is("found_at", null)
    .order("created_at", { ascending: false }); // 최신순
  if (error) return new NextResponse(`DB 오류: ${error.message}`, { status: 500 });

  const now = Date.now();
  const list = (data ?? []).map((d) => ({
    id: d.id,
    nickname: d.nickname,
    hiddenMs: now - new Date(d.created_at).getTime(), // 밀리초 단위 — 정밀 정렬·시간 단위 표시용
    thumbnailUrl: `/api/drawings/${d.id}/thumb`,
    isMine: d.device_id === deviceId,
  }));
  return NextResponse.json(list, { headers: { "Cache-Control": "no-store" } });
}

const MAX_BODY_BYTES = 3 * 1024 * 1024; // dataURL 기준 상한
const UPLOADS_PER_HOUR = 5;

interface UploadBody {
  nickname?: string;
  imageDataUrl?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

/** 알파 채널 기준 실제 그림 영역(bbox)과 잉크량(불투명 픽셀 수)을 구한다 */
async function alphaBbox(buf: Buffer) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1, ink = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > ALPHA_VISIBLE) {
        ink++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // 완전히 빈 이미지
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, imgW: info.width, imgH: info.height, ink };
}

export async function POST(req: Request) {
  const deviceId = req.headers.get("x-device-id");
  if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
    return new NextResponse("device id가 없습니다", { status: 400 });
  }

  let body: UploadBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("잘못된 요청 본문", { status: 400 });
  }

  const nickname = (body.nickname ?? "").trim().slice(0, 7);
  if (!nickname) return new NextResponse("닉네임을 입력해주세요", { status: 400 });

  const dataUrl = body.imageDataUrl ?? "";
  if (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length > MAX_BODY_BYTES) {
    return new NextResponse("이미지 형식이 올바르지 않습니다", { status: 400 });
  }
  const png = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");

  const { x, y, w, h } = body;
  if (![x, y, w, h].every((v) => Number.isFinite(v))) {
    return new NextResponse("배치 좌표가 올바르지 않습니다", { status: 400 });
  }

  const meta = await readTilesetMeta();
  const db = getServiceClient();

  // 레이트리밋: 최근 1시간 업로드 수
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: recent, error: rlErr } = await db
    .from("drawings")
    .select("id", { count: "exact", head: true })
    .eq("device_id", deviceId)
    .gte("created_at", hourAgo);
  if (rlErr) return new NextResponse(`DB 오류: ${rlErr.message}`, { status: 500 });
  if ((recent ?? 0) >= UPLOADS_PER_HOUR) {
    return new NextResponse("시간당 업로드 한도(5개)를 초과했어요. 잠시 후 다시 시도해주세요", { status: 429 });
  }

  // 투명 여백 trim → 배치 좌표 보정 (미리보기와 동일한 시각 결과 유지)
  const bbox = await alphaBbox(png);
  if (!bbox) return new NextResponse("빈 그림은 숨길 수 없어요", { status: 400 });

  const scaleX = (w as number) / bbox.imgW;
  const scaleY = (h as number) / bbox.imgH;
  const rect = {
    x: Math.round((x as number) + bbox.left * scaleX),
    y: Math.round((y as number) + bbox.top * scaleY),
    w: Math.max(1, Math.round(bbox.width * scaleX)),
    h: Math.max(1, Math.round(bbox.height * scaleY)),
  };

  const long = Math.max(rect.w, rect.h);
  if (long > MAX_LONG) return new NextResponse(`그림이 너무 커요 (최대 ${MAX_LONG}px)`, { status: 400 });
  if (long < MIN_TRIMMED_LONG) {
    return new NextResponse(`그림이 너무 작아요 (최소 ${MIN_TRIMMED_LONG}px) — 패드에 좀 더 크게 그려주세요`, { status: 400 });
  }
  // bbox 크기와 별개로 잉크 총량 검사 — 점 몇 개로 bbox만 벌리는 업로드 차단
  const inkWorld = bbox.ink * scaleX * scaleY;
  if (inkWorld < MIN_INK_WORLD) {
    return new NextResponse("그림이 너무 희미해요 — 패드에 좀 더 그려주세요", { status: 400 });
  }
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > meta.width || rect.y + rect.h > meta.height) {
    return new NextResponse("그림이 캔버스를 벗어났어요", { status: 400 });
  }

  // trim된 PNG 저장
  const id = randomUUID();
  const trimmed = await sharp(png)
    .extract({ left: bbox.left, top: bbox.top, width: bbox.width, height: bbox.height })
    .png()
    .toBuffer();
  const imagePath = await saveDrawingPng(id, trimmed);

  // DB 기록
  const { error: insErr } = await db.from("drawings").insert({
    id,
    nickname,
    device_id: deviceId,
    image_path: imagePath,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
  });
  if (insErr) return new NextResponse(`DB 오류: ${insErr.message}`, { status: 500 });

  // 영향 타일 재합성 (미발견 그림 전체 기준)
  const { data: unfoundRows, error: selErr } = await db
    .from("drawings")
    .select("id, x, y, w, h, image_path")
    .is("found_at", null);
  if (selErr) return new NextResponse(`DB 오류: ${selErr.message}`, { status: 500 });
  const unfound = await loadDrawingRects((unfoundRows ?? []) as DrawingRow[]);
  await recompositeTiles(tilesForBbox(rect, meta), unfound, meta);

  // 전역 버전 +1
  const { data: version, error: verErr } = await db.rpc("bump_canvas_version");
  if (verErr) return new NextResponse(`DB 오류: ${verErr.message}`, { status: 500 });

  return NextResponse.json({ id, version: Number(version) });
}
