import { ALPHA_VISIBLE } from "./placement";

interface Point { x: number; y: number }

export interface InkMetrics {
  left: number;
  top: number;
  width: number;
  height: number;
  ink: number;
  hull: Point[];
}

const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function convexHull(points: Point[]): Point[] {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const unique = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  const lower: Point[] = [], upper: Point[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** RGBA의 보이는 픽셀만으로 면적과 외곽을 측정한다. 각 행의 양 끝점만으로 같은 볼록 껍질을 얻는다. */
export function measureInk(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): InkMetrics | null {
  let left = width, top = height, right = -1, bottom = -1, ink = 0;
  const points: Point[] = [];
  for (let y = 0; y < height; y++) {
    let rowLeft = width, rowRight = -1;
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] <= ALPHA_VISIBLE) continue;
      ink++;
      rowLeft = Math.min(rowLeft, x);
      rowRight = x;
    }
    if (rowRight < 0) continue;
    left = Math.min(left, rowLeft);
    right = Math.max(right, rowRight);
    top = Math.min(top, y);
    bottom = y;
    // Include pixel corners, so a one-pixel stroke has width 1 rather than 0.
    points.push(
      { x: rowLeft, y }, { x: rowRight + 1, y },
      { x: rowLeft, y: y + 1 }, { x: rowRight + 1, y: y + 1 },
    );
  }
  if (right < 0) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1, ink, hull: convexHull(points) };
}

/** 잉크 영역을 감싸는 평행선 사이의 최소 간격. 회전·가로세로 확대율을 반영해 가는 직선을 판정한다. */
export function minimumInkWidth(metrics: InkMetrics, scaleX = 1, scaleY = scaleX): number {
  const { hull } = metrics;
  let minimum = Infinity, opposite = 1;
  // Rotating calipers: the farthest vertex advances monotonically around the hull.
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const dx = (b.x - a.x) * scaleX, dy = (b.y - a.y) * scaleY;
    const area = (j: number) => Math.abs(
      dx * (hull[j].y - a.y) * scaleY - dy * (hull[j].x - a.x) * scaleX,
    );
    while (area((opposite + 1) % hull.length) > area(opposite) + 1e-9) opposite = (opposite + 1) % hull.length;
    minimum = Math.min(minimum, area(opposite) / Math.hypot(dx, dy));
  }
  return minimum;
}
