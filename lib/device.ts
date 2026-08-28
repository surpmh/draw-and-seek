"use client";

const KEY = "das_device_id";
const NICK_KEY = "das_nickname";
const EMPTY_KEY = "das_empty_dismissed";

/** localStorage에 보관되는 익명 device UUID (내 그림 표시·레이트리밋용) */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getLastNickname(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NICK_KEY) || "";
}

export function saveNickname(nick: string) {
  if (typeof window !== "undefined") localStorage.setItem(NICK_KEY, nick);
}

/** "아직 숨겨진 그림이 없습니다" 안내를 닫은 적 있는지 — 한 번 닫으면 다시 띄우지 않는다 */
export function isEmptyNoticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(EMPTY_KEY) === "1";
}

export function dismissEmptyNotice() {
  if (typeof window !== "undefined") localStorage.setItem(EMPTY_KEY, "1");
}
