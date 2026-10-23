import { getServiceClient } from "./supabase";

/**
 * Supabase Storage 저장 계층 (서버 전용).
 * Vercel 등 서버리스 환경엔 영속 디스크가 없으므로 그림 PNG·타일을 전부 여기에 둔다.
 *
 * 키 구조 (비공개 버킷 — 서빙은 항상 API 라우트를 거친다):
 *   tiles/meta.json                 타일셋 메타
 *   tiles/base/{z}/{x}/{y}.webp     원본 타일 (재합성 입력, 불변)
 *   tiles/serve/{z}/{x}/{y}.webp    서빙 타일 (base + 미발견 그림 합성)
 *   drawings/{id}.png               숨긴 그림 원본 (trim된 PNG)
 */

export const BUCKET = "canvas";

/** 없으면 null (Storage 오류도 not-found로 취급 — 호출부는 404 처리) */
export async function storageDownload(key: string): Promise<Buffer | null> {
  const { data, error } = await getServiceClient().storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * CDN 캐시를 거치지 않고 원본을 읽는다 — 덮어쓰는 키(tiles/serve/) 전용.
 * 일반 download()는 Supabase CDN이 경로 기준으로 캐시해(max-age=3600, 쿼리 무시)
 * 덮어쓴 직후 옛 내용을 줄 수 있다. 서명 URL은 토큰마다 캐시 키가 달라 항상 MISS.
 */
export async function storageDownloadFresh(key: string): Promise<Buffer | null> {
  const { data, error } = await getServiceClient().storage.from(BUCKET).createSignedUrl(key, 60);
  if (error || !data) return null;
  const res = await fetch(data.signedUrl, { cache: "no-store" });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function storageUpload(key: string, buf: Buffer, contentType: string): Promise<void> {
  const { error } = await getServiceClient()
    .storage.from(BUCKET)
    .upload(key, buf, { contentType, upsert: true });
  if (error) throw new Error(`Storage 업로드 실패 (${key}): ${error.message}`);
}
