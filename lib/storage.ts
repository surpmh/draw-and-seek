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

export async function storageUpload(key: string, buf: Buffer, contentType: string): Promise<void> {
  const { error } = await getServiceClient()
    .storage.from(BUCKET)
    .upload(key, buf, { contentType, upsert: true });
  if (error) throw new Error(`Storage 업로드 실패 (${key}): ${error.message}`);
}
