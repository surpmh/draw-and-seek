import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_LONG, MAX_LONG, resizePlacement } from "../lib/placement.ts";

const meta = { width: 4096, height: 4096 };
const placing = { img: "drawing.png", x: 200, y: 300, w: 80, h: 80, rotation: 45 };
const oppositeCorner = (p, corner) => [
  corner.endsWith("w") ? p.x + p.w : p.x,
  corner.startsWith("n") ? p.y + p.h : p.y,
];

for (const corner of ["nw", "ne", "sw", "se"]) {
  test(`${corner}: resizing keeps the opposite corner and rotated image fixed`, () => {
    let p = placing;
    for (const side of [100, 55, 77.6, 120, 80]) {
      p = resizePlacement(p, side, corner, meta);
      assert.deepEqual(oppositeCorner(p, corner), oppositeCorner(placing, corner));
      assert.equal(p.w, Math.round(side));
      assert.equal(p.h, p.w);
      assert.equal(p.img, placing.img);
      assert.equal(p.rotation, placing.rotation);
    }
  });

  test(`${corner}: resizing stops at the size limits without flipping`, () => {
    const small = resizePlacement(placing, -500, corner, meta);
    const large = resizePlacement(placing, 500, corner, meta);
    assert.equal(small.w, MIN_LONG);
    assert.equal(large.w, MAX_LONG);
    assert.deepEqual(oppositeCorner(small, corner), oppositeCorner(placing, corner));
    assert.deepEqual(oppositeCorner(large, corner), oppositeCorner(placing, corner));
  });

  for (const axis of ["x", "y"]) {
    test(`${corner}: resizing stops at the ${axis} canvas edge`, () => {
      const nearEdge = { ...placing };
      if (axis === "x") nearEdge.x = corner.endsWith("w") ? 10 : meta.width - 90;
      else nearEdge.y = corner.startsWith("n") ? 10 : meta.height - 90;
      const p = resizePlacement(nearEdge, MAX_LONG, corner, meta);
      assert.equal(p.w, 90);
      assert.equal(p.h, 90);
      assert.ok(p.x >= 0 && p.x + p.w <= meta.width);
      assert.ok(p.y >= 0 && p.y + p.h <= meta.height);
      assert.deepEqual(oppositeCorner(p, corner), oppositeCorner(nearEdge, corner));
    });
  }
}
