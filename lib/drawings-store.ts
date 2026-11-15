import { storageDownload, storageUpload } from "./storage";

export interface DrawingRow {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  image_path: string;
}

/** DB의 image_path(`{id}.png`) → Storage 키 */
const drawingKey = (imagePath: string) => `drawings/${imagePath}`;

export async function saveDrawingPng(id: string, buf: Buffer): Promise<string> {
  const rel = `${id}.png`;
  await storageUpload(drawingKey(rel), buf, "image/png");
  return rel;
}

export async function loadDrawingPng(imagePath: string): Promise<Buffer | null> {
  return storageDownload(drawingKey(imagePath));
}
