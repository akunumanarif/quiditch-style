import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makePilot,
  neutralInput,
  stepFlight,
  type Pilot,
  type FlightInput,
} from "../packages/shared/index.ts";
const run = (p: Pilot, i: FlightInput, seconds: number) => {
  for (let n = 0; n < Math.round(seconds * 120); n++) stepFlight(p, i, 1 / 120);
};
test("A/D alone changes attitude without adding movement or yaw", () => {
  for (const thrust of [0])
    for (const direction of [-1, 1]) {
      const neutral = makePilot("baseline"),
        banked = makePilot("banked");
      run(neutral, { ...neutralInput(), forward: thrust }, 1.2);
      run(
        banked,
        { ...neutralInput(), forward: thrust, strafe: direction },
        1.2,
      );
      for (const key of ["x", "y", "z", "vx", "vy", "vz", "yaw"] as const)
        assert.ok(
          Math.abs(neutral[key] - banked[key]) < 1e-10,
          `${key} changed due to roll input`,
        );
      assert.ok(
        direction * banked.bank < -0.65,
        "left/right must reach a visible bank arc",
      );
      assert.equal(banked.forwardAxis, neutral.forwardAxis);
    }
});
test("roll has angular inertia, finite acceleration and settles upright on release", () => {
  const p = makePilot("inertia");
  stepFlight(p, { ...neutralInput(), strafe: -1 }, 1 / 60);
  assert.ok(p.bank > 0 && p.bank < 0.01);
  assert.ok(p.bankVelocity > 0);
  run(p, { ...neutralInput(), strafe: -1 }, 0.7);
  const bank = p.bank,
    velocity = p.bankVelocity;
  stepFlight(p, { ...neutralInput(), strafe: 1 }, 1 / 120);
  assert.ok(p.bank > 0);
  assert.ok(Math.abs(p.bankVelocity - velocity) <= 14 / 120 + 0.000001);
  assert.ok(Math.abs(p.bank - bank) < 0.025);
  run(p, neutralInput(), 2);
  assert.ok(Math.abs(p.bank) < 0.025);
  assert.ok(Math.abs(p.bankVelocity) < 0.03);
});
test("airspeed-dependent pressure adds roll resistance without sideways acceleration", () => {
  const hover = makePilot("hover"),
    fast = makePilot("fast");
  fast.vz = 30;
  run(hover, { ...neutralInput(), strafe: 1 }, 0.4);
  run(fast, { ...neutralInput(), strafe: 1 }, 0.4);
  assert.ok(fast.pressure > hover.pressure + 100);
  assert.ok(Math.abs(fast.bank) < Math.abs(hover.bank));
  assert.ok(fast.rollLoad > 0);
  assert.ok(Math.abs(fast.bankVelocity) <= 2.1);
});

test("reduced motion retains deliberate A/D attitude while suppressing extra torso sway", async () => {
  const { createFlightPose, stepFlightPose } =
    await import("../apps/web/src/gameplay/flight-pose.ts");
  const p = makePilot("reduced");
  run(p, { ...neutralInput(), strafe: -1 }, 1);
  const pose = createFlightPose(p);
  for (let n = 0; n < 60; n++) stepFlightPose(pose, p, 1 / 60, true);
  assert.ok(pose.bank.value > 0.6);
  assert.ok(Math.abs(pose.torsoLean.value) < 0.001);
  run(p, neutralInput(), 2);
  for (let n = 0; n < 60; n++) stepFlightPose(pose, p, 1 / 60, true);
  assert.ok(Math.abs(pose.bank.value) < 0.02);
});

test("W plus A/D redirects thrust diagonally toward the lean while preserving facing", () => {
  for (const yaw of [0, Math.PI / 2])
    for (const direction of [-1, 1]) {
      const p = makePilot("diagonal");
      p.yaw = yaw;
      run(p, { ...neutralInput(), forward: 1, strafe: direction, yaw }, 1.4);
      const lateral = Math.cos(yaw) * p.vx - Math.sin(yaw) * p.vz;
      const forward = Math.sin(yaw) * p.vx + Math.cos(yaw) * p.vz;
      assert.ok(
        direction * lateral > 3,
        "thrust must follow the requested lean",
      );
      assert.ok(forward > 5, "diagonal flight must retain forward motion");
      assert.ok(
        Math.abs(p.yaw - yaw) < 1e-9,
        "bank must not rotate the facing",
      );
    }
});
test("banked thrust redirects gradually, coasts on release and stays within the speed bound", () => {
  const p = makePilot("gradual");
  run(p, { ...neutralInput(), forward: 1 }, 0.8);
  const before = p.vx;
  stepFlight(p, { ...neutralInput(), forward: 1, strafe: -1 }, 1 / 60);
  assert.ok(
    Math.abs(p.vx - before) < 0.15,
    "bank must not instantaneously strafe",
  );
  run(p, { ...neutralInput(), forward: 1, strafe: -1, boost: true }, 1);
  assert.ok(p.vx < -3);
  const previous = p.vx;
  stepFlight(p, { ...neutralInput(), strafe: -1 }, 1 / 60);
  assert.ok(p.vx < 0);
  assert.ok(
    Math.abs(p.vx - previous) < 1,
    "releasing W must not cancel momentum",
  );
  assert.ok(Math.hypot(p.vx, p.vy, p.vz) <= 52.001);
});
