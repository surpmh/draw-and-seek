"use client";

import { useEffect, useState } from "react";

/**
 * 모바일 레이아웃 분기 (뷰포트 폭 기준).
 * SSR·첫 렌더는 false(데스크톱) — 마운트 후 실제 값으로 갱신된다.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}
