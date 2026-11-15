import type { InkMetrics } from "./ink-metrics";

export interface DrawingInspection extends InkMetrics {
  imgW: number;
  imgH: number;
}

/** 네이티브 이미지 처리는 Supabase Free Edge Function의 WASM에서 수행한다. */
export async function imageService(
  operation: "inspect" | "save" | "thumbnail" | "tile",
  body: BodyInit,
  headers: Record<string, string> = {},
): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 이미지 서비스 설정이 없습니다");

  const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/image-service/${operation}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
      authorization: `Bearer ${key}`,
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    // 응답 본문에는 내부 경로/DB 오류가 포함될 수 있으므로 브라우저로 전달하지 않는다.
    throw new Error(`이미지 서비스 ${operation} 실패 (${response.status})`);
  }
  return response;
}

export async function inspectDrawing(png: Buffer): Promise<DrawingInspection | null> {
  const response = await imageService("inspect", new Uint8Array(png), { "content-type": "image/png" });
  return response.json();
}

export async function storeDrawing(id: string, png: Buffer): Promise<string> {
  const response = await imageService("save", new Uint8Array(png), {
    "content-type": "image/png",
    "x-drawing-id": id,
  });
  const { imagePath } = await response.json() as { imagePath: string };
  return imagePath;
}
