import {
  BadImageError, compositeSource, compositeTile, inspectPng, prepareDrawing, thumbnail,
  type TileRequest,
} from "./engine.ts";

export interface ImageStorage {
  download(key: string): Promise<Uint8Array | null>;
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i;
const MAX_BYTES = 3 * 1024 * 1024;

async function authorized(request: Request, secret: string) {
  if (!secret) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const encoder = new TextEncoder();
  const hashes = await Promise.all([supplied, `Bearer ${secret}`].map((value) =>
    crypto.subtle.digest("SHA-256", encoder.encode(value)),
  ));
  const a = new Uint8Array(hashes[0]), b = new Uint8Array(hashes[1]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

function validateTile(payload: TileRequest) {
  const { tile, meta, drawings } = payload;
  if (!tile || !meta || !Array.isArray(drawings) || drawings.length > 1000 ||
    ![tile.z, tile.tx, tile.ty, meta.width, meta.height, meta.maxZoom].every(Number.isInteger) ||
    meta.width <= 0 || meta.height <= 0 || meta.maxZoom < 0 || meta.maxZoom > 16 ||
    tile.z < 0 || tile.z > meta.maxZoom || tile.tx < 0 || tile.ty < 0) {
    throw new BadImageError("잘못된 타일 요청");
  }
  const f = 2 ** (meta.maxZoom - tile.z);
  if (tile.tx >= Math.ceil(meta.width / (512 * f)) || tile.ty >= Math.ceil(meta.height / (512 * f))) {
    throw new BadImageError("캔버스 밖 타일");
  }
  for (const drawing of drawings) {
    if (!IMAGE_PATH.test(drawing.image_path) || ![drawing.x, drawing.y, drawing.w, drawing.h].every(Number.isFinite) ||
      drawing.w <= 0 || drawing.h <= 0 || Math.max(drawing.w, drawing.h) > 128) {
      throw new BadImageError("잘못된 그림 정보");
    }
  }
}

export function createImageHandler(storage: ImageStorage, secret: string) {
  return async (request: Request): Promise<Response> => {
    if (!await authorized(request, secret)) return new Response("unauthorized", { status: 401 });
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    if (Number(request.headers.get("content-length")) > MAX_BYTES) return new Response("too large", { status: 413 });
    try {
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length > MAX_BYTES) return new Response("too large", { status: 413 });
      const operation = new URL(request.url).pathname.split("/").pop();
      if (operation === "inspect") return Response.json(inspectPng(bytes));
      if (operation === "save") {
        const id = request.headers.get("x-drawing-id") ?? "";
        if (!UUID.test(id)) throw new BadImageError("잘못된 그림 id");
        const result = prepareDrawing(bytes);
        await Promise.all([
          storage.upload(`drawings/${id}.png`, result.png, "image/png"),
          storage.upload(`thumbnails/${id}.webp`, result.thumb, "image/webp"),
          storage.upload(`composites/${id}.png`, result.composite, "image/png"),
        ]);
        return Response.json({ imagePath: `${id}.png` });
      }
      if (operation === "thumbnail") {
        const { imagePath } = JSON.parse(new TextDecoder().decode(bytes));
        if (typeof imagePath !== "string" || !IMAGE_PATH.test(imagePath)) throw new BadImageError("잘못된 이미지 경로");
        const source = await storage.download(`drawings/${imagePath}`);
        if (!source) return new Response("not found", { status: 404 });
        const result = thumbnail(source);
        await storage.upload(`thumbnails/${imagePath.replace(/\.png$/, ".webp")}`, result, "image/webp");
        return new Response(new Uint8Array(result), { headers: { "content-type": "image/webp" } });
      }
      if (operation === "tile") {
        const payload = JSON.parse(new TextDecoder().decode(bytes)) as TileRequest;
        validateTile(payload);
        const { tile, drawings, meta } = payload;
        const base = await storage.download(`tiles/base/${tile.z}/${tile.tx}/${tile.ty}.webp`);
        if (!base) throw new Error("base tile missing");
        const f = 2 ** (meta.maxZoom - tile.z);
        const left = tile.tx * 512 * f, top = tile.ty * 512 * f;
        const overlapping = drawings.filter((d) => d.x + d.w > left && d.x < left + 512 * f && d.y + d.h > top && d.y < top + 512 * f);
        const overlays = [];
        for (const drawing of overlapping) {
          let source = await storage.download(`composites/${drawing.image_path}`);
          if (!source) {
            const original = await storage.download(`drawings/${drawing.image_path}`);
            if (!original) throw new Error("drawing image missing");
            source = compositeSource(original);
            await storage.upload(`composites/${drawing.image_path}`, source, "image/png");
          }
          overlays.push({ ...drawing, bytes: source });
        }
        const result = compositeTile(base, overlays, payload);
        await storage.upload(`tiles/serve/${tile.z}/${tile.tx}/${tile.ty}.webp`, result, "image/webp");
        return Response.json({ ok: true });
      }
      return new Response("not found", { status: 404 });
    } catch (error) {
      if (error instanceof BadImageError || error instanceof SyntaxError) {
        return new Response("invalid image request", { status: 400 });
      }
      console.error("image-service failed", error);
      return new Response("image processing failed", { status: 500 });
    }
  };
}
