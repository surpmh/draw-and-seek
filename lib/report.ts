/**
 * 신고 사유 코드 — 클라이언트(모달 선택지)와 서버(검증)가 공유한다.
 * DB에는 이 코드가 그대로 들어가므로 값을 바꾸면 기존 신고 기록과 어긋난다.
 */
export const REPORT_REASONS = ["inappropriate", "sexual", "hate", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(v: unknown): v is ReportReason {
  return typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v);
}
