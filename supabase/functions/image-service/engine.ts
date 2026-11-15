import {
  ColorSpace,
  CompositeOperator,
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  MagickGeometry,
  Point,
  type IMagickImage,
} from "@imagemagick/magick-wasm";
import { measureInk } from "./shared/ink-metrics.ts";

export const initializeImageEngine = initializeImageMagick;

export interface DrawingReference {
  id: string;
  image_path: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileRequest {
  tile: { z: number; tx: number; ty: number };
  drawings: DrawingReference[];
  meta: { width: number; height: number; maxZoom: number };
}

export class BadImageError extends Error {}

// Bound decoded memory before handing an untrusted upload to WASM.
function checkPng(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((byte, i) => bytes[i] !== byte)) {
    throw new BadImageError("PNG 파일이 아닙니다");
  }
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = header.getUint32(16), height = header.getUint32(20);
  if (!width || !height || width > 2048 || height > 2048 || width * height > 4_194_304) {
    throw new BadImageError("이미지 해상도가 너무 큽니다");
  }
}

function metrics(image: IMagickImage) {
  image.colorSpace = ColorSpace.sRGB;
  return image.getPixels((pixels) => {
    const rgba = pixels.toByteArray(0, 0, image.width, image.height, "RGBA");
    if (!rgba) throw new BadImageError("이미지 픽셀을 읽지 못했습니다");
    const measured = measureInk(rgba, image.width, image.height);
    return measured ? { ...measured, imgW: image.width, imgH: image.height } : null;
  });
}

export function inspectPng(bytes: Uint8Array) {
  checkPng(bytes);
  return ImageMagick.read(bytes, metrics);
}

function resizeExact(image: IMagickImage, width: number, height: number) {
  const geometry = new MagickGeometry(width, height);
  geometry.ignoreAspectRatio = true;
  image.resize(geometry);
  image.resetPage();
}

function resizeInside(image: IMagickImage, side: number) {
  const scale = Math.min(1, side / Math.max(image.width, image.height));
  resizeExact(image, Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
}

export function thumbnail(bytes: Uint8Array): Uint8Array {
  return ImageMagick.read(bytes, (image) => {
    resizeInside(image, 96);
    image.quality = 80;
    return image.write(MagickFormat.WebP, (data) => data.slice());
  });
}

export function prepareDrawing(bytes: Uint8Array) {
  checkPng(bytes);
  return ImageMagick.read(bytes, (image) => {
    const bbox = metrics(image);
    if (!bbox) throw new BadImageError("빈 그림입니다");
    image.crop(new MagickGeometry(bbox.left, bbox.top, bbox.width, bbox.height));
    image.resetPage();
    const png = image.write(MagickFormat.Png, (data) => data.slice());
    // The game never displays a drawing larger than 128 world pixels.
    resizeInside(image, 128);
    const composite = image.write(MagickFormat.Png, (data) => data.slice());
    return { png, composite, thumb: thumbnail(png) };
  });
}

export function compositeSource(bytes: Uint8Array): Uint8Array {
  return ImageMagick.read(bytes, (image) => {
    resizeInside(image, 128);
    return image.write(MagickFormat.Png, (data) => data.slice());
  });
}

/** Process exactly one 512px tile per invocation to bound free-tier CPU work. */
export function compositeTile(
  base: Uint8Array,
  overlays: Array<DrawingReference & { bytes: Uint8Array }>,
  request: TileRequest,
): Uint8Array {
  const { tile, meta } = request;
  const f = 2 ** (meta.maxZoom - tile.z);
  const tileLeft = tile.tx * 512 * f, tileTop = tile.ty * 512 * f;
  return ImageMagick.read(base, (image) => {
    for (const drawing of overlays) {
      const rw = Math.max(1, Math.round(drawing.w / f));
      const rh = Math.max(1, Math.round(drawing.h / f));
      const ox = (drawing.x - tileLeft) / f, oy = (drawing.y - tileTop) / f;
      const ix0 = Math.max(0, Math.floor(ox)), iy0 = Math.max(0, Math.floor(oy));
      const ix1 = Math.min(image.width, Math.ceil(ox + rw));
      const iy1 = Math.min(image.height, Math.ceil(oy + rh));
      const sx = Math.min(rw - 1, Math.max(0, ix0 - Math.round(ox)));
      const sy = Math.min(rh - 1, Math.max(0, iy0 - Math.round(oy)));
      const width = Math.min(ix1 - ix0, rw - sx), height = Math.min(iy1 - iy0, rh - sy);
      if (width <= 0 || height <= 0) continue;
      ImageMagick.read(drawing.bytes, (overlay) => {
        resizeExact(overlay, rw, rh);
        overlay.crop(new MagickGeometry(sx, sy, width, height));
        overlay.resetPage();
        image.composite(overlay, CompositeOperator.Over, new Point(ix0, iy0));
      });
    }
    image.quality = 95;
    return image.write(MagickFormat.WebP, (data) => data.slice());
  });
}
