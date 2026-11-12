import { test } from "node:test";
import assert from "node:assert/strict";
import {
  safeCamera,
  segmentDistance,
  COURSE_DURATION,
} from "../packages/shared/flight-course.ts";
import {
  makePilot,
  neutralInput,
  stepFlight,
} from "../packages/shared/index.ts";
test("fast waypoint crossings are detected along movement segment", () => {
  assert.equal(
    segmentDistance(
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 10, z: -10 },
      { x: 0, y: 10, z: 10 },
    ),
    0,
  );
  assert.equal(
    segmentDistance(
      { x: 5, y: 10, z: 0 },
      { x: 0, y: 10, z: -10 },
      { x: 0, y: 10, z: 10 },
    ),
    5,
  );
  assert.equal(COURSE_DURATION, 60);
});
test("camera remains finite for getter-based engine vectors, respects floor and perimeter", () => {
  const desired = {
    get x() {
      return 80;
    },
    get y() {
      return -3;
    },
    get z() {
      return 0;
    },
  };
  const camera = safeCamera({ x: 50, y: 6, z: 0 }, desired);
  assert.ok(Object.values(camera).every(Number.isFinite));
  assert.ok(camera.x <= 54.5 && camera.y >= 2.5);
});
test("camera shortens follow distance when a goal post occludes the rider", () => {
  const camera = safeCamera({ x: 0, y: 12, z: 77 }, { x: 0, y: 13, z: 84 });
  assert.ok(camera.z < 79);
});
test("combined strafe/forward/ascend input cannot exceed boost speed", () => {
  const p = makePilot("speed");
  for (let n = 0; n < 40; n++)
    stepFlight(
      p,
      { ...neutralInput(), forward: 1, strafe: 1, lift: 1, boost: true },
      1 / 60,
    );
  assert.ok(Math.hypot(p.vx, p.vy, p.vz) <= 52.001);
});
test("ground and goal collisions recover without clipping", () => {
  const p = makePilot("collision");
  p.x = 0;
  p.z = 78.9;
  p.y = 10;
  stepFlight(p, neutralInput(), 1 / 60);
  assert.ok(Math.hypot(p.x, p.z - 79) >= 0.699);
  assert.ok(p.recovery > 0);
  p.y = 2;
  p.vy = -10;
  stepFlight(p, neutralInput(), 1 / 60);
  assert.equal(p.y, 3);
  assert.ok(p.vy >= 0);
});
