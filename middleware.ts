import { NextResponse, type NextRequest } from "next/server";

/**
 * 숨은 관리자 경로 라우팅.
 * 실제 페이지/API는 평범한 내부 경로(admin-console)에 있지만 직접 접근은 404로 막고,
 * ADMIN_SLUG 환경변수의 비밀 슬러그로 온 요청만 내부 경로로 rewrite 한다.
 * → 코드/저장소에는 비밀 경로가 남지 않고, 슬러그 교체도 env 수정만으로 끝난다.
 * ADMIN_SLUG 미설정 시 관리자 기능 전체가 접근 불가(안전한 기본값).
 */

const INTERNAL_PAGE = "/admin-console";
const INTERNAL_API = "/api/admin-console";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 내부 경로 직접 접근 차단 (rewrite를 거치지 않은 요청)
  if (
    pathname === INTERNAL_PAGE ||
    pathname.startsWith(`${INTERNAL_PAGE}/`) ||
    pathname === INTERNAL_API ||
    pathname.startsWith(`${INTERNAL_API}/`)
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const slug = process.env.ADMIN_SLUG;
  if (!slug) return NextResponse.next();

  if (pathname === `/${slug}`) {
    return NextResponse.rewrite(new URL(INTERNAL_PAGE, req.url));
  }
  if (pathname.startsWith(`/api/${slug}/`)) {
    const rest = pathname.slice(`/api/${slug}`.length);
    return NextResponse.rewrite(new URL(INTERNAL_API + rest, req.url));
  }
  return NextResponse.next();
}

// 정적 자산은 제외 (타일 등 API는 위 문자열 비교만 거치므로 부담 없음)
export const config = {
  matcher: ["/((?!_next/|favicon).*)"],
};
