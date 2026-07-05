import { NextResponse } from "next/server";
import { verifyPassword, adminSessionCookie, adminLogoutCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** 무차별 대입 완화: IP별 최근 실패 기록 (프로세스 메모리 — 재시작 시 초기화) */
const failures = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 8;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_FAILURES) {
    return new NextResponse("시도가 너무 많습니다. 잠시 후 다시 시도해주세요", { status: 429 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("잘못된 요청 본문", { status: 400 });
  }

  let ok = false;
  try {
    ok = verifyPassword(body.password ?? "");
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }

  if (!ok) {
    recent.push(now);
    failures.set(ip, recent);
    return new NextResponse("비밀번호가 올바르지 않습니다", { status: 401 });
  }

  failures.delete(ip);
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": adminSessionCookie() } },
  );
}

/** 로그아웃 */
export async function DELETE() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": adminLogoutCookie() } },
  );
}
