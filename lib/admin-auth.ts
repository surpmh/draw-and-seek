import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 관리자 인증 (서버 전용).
 * ADMIN_PASSWORD 환경변수로 로그인하면 HMAC 토큰을 HttpOnly 쿠키에 심는다.
 * 토큰은 무상태로 검증 가능 — 비밀번호를 바꾸면 기존 세션 전부 무효화된다.
 */

const ADMIN_COOKIE = "das_admin";
const ADMIN_SESSION_MAX_AGE = 12 * 3600; // 12시간

function getPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD 환경변수가 없습니다 (.env.local 확인)");
  return pw;
}

function sessionToken(): string {
  return createHmac("sha256", getPassword()).update("drawandseek-admin-session").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function verifyPassword(input: string): boolean {
  return safeEqual(input, getPassword());
}

/** 로그인 성공 시 내려줄 Set-Cookie 값 */
export function adminSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${sessionToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_SESSION_MAX_AGE}${secure}`;
}

/** 로그아웃용 즉시 만료 쿠키 */
export function adminLogoutCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

/** 요청 쿠키에서 관리자 세션 검증 */
export function isAdminRequest(req: Request): boolean {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([0-9a-f]+)`));
  if (!match) return false;
  try {
    return safeEqual(match[1], sessionToken());
  } catch {
    return false; // ADMIN_PASSWORD 미설정 등
  }
}
