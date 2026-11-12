import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makePilot,
  neutralInput,
  stepFlight,
} from "../packages/shared/index.ts";
import { angleDelta, dampAngle, spring } from "../packages/shared/motion.ts";
import {
  createFlightPose,
  stepFlightPose,
  FLIGHT_CLIPS,
} from "../apps/web/src/gameplay/flight-pose.ts";

test("heading takes the short path across ±pi and does not snap to mouse heading", () => {
  const p = makePilot("turn");
  p.yaw = Math.PI - 0.02;
  const before = p.yaw;
  stepFlight(p, { ...neutralInput(), yaw: -Math.PI + 0.02 }, 1 / 60);
  assert.ok(Math.abs(angleDelta(before, p.yaw)) < 0.02);
  assert.ok(angleDelta(before, p.yaw) > 0);
  p.yaw = 0;
  stepFlight(p, { ...neutralInput(), yaw: Math.PI }, 1 / 60);
  assert.ok(p.yaw > 0 && p.yaw <= 3.8 / 60 + 0.00001);
  assert.equal(dampAngle(1, 2, 12, 0), 1);
});
test("vertical input eases in, reverses continuously, and brakes promptly", () => {
  const p = makePilot("vertical"),
    up = { ...neutralInput(), lift: 1 };
  stepFlight(p, up, 1 / 60);
  assert.ok(p.vy > 0 && p.vy < 0.3);
  for (let n = 0; n < 17; n++) stepFlight(p, up, 1 / 60);
  assert.ok(p.vy > 1, "hover lift must respond within 300ms");
  const before = p.vy;
  stepFlight(p, { ...neutralInput(), lift: -1 }, 1 / 60);
  assert.ok(p.vy > 0);
  assert.ok(Math.abs(p.vy - before) < 1.5, "no upward/downward velocity snap");
  for (let n = 0; n < 180; n++) stepFlight(p, neutralInput(), 1 / 60);
  assert.ok(Math.abs(p.vy) < 0.3);
});
test("flight response stays close at server 30Hz and practice 60Hz", () => {
  const simulate = (hz: number) => {
    const p = makePilot("rate");
    for (let n = 0; n < hz; n++)
      stepFlight(
        p,
        {
          ...neutralInput(),
          forward: 0.8,
          strafe: 0.4,
          lift: 0.3,
          yaw: 0.6,
          pitch: 0.2,
        },
        1 / hz,
      );
    return p;
  };
  const a = simulate(30),
    b = simulate(60);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.6);
  assert.ok(Math.abs(a.vy - b.vy) < 0.2);
  assert.ok(Math.abs(angleDelta(a.yaw, b.yaw)) < 0.01);
});
test("bank reverses smoothly and lift produces a gradual pitched flight pose", () => {
  const p = makePilot("pose"),
    pose = createFlightPose(p);
  p.vx = 12;
  p.bank = -0.5;
  for (let n = 0; n < 45; n++) stepFlightPose(pose, p, 1 / 60);
  assert.ok(pose.bank.value < -0.15);
  const before = pose.bank.value;
  p.vx = -12;
  p.bank = 0.5;
  stepFlightPose(pose, p, 1 / 60);
  assert.ok(pose.bank.value < 0);
  assert.ok(Math.abs(pose.bank.value - before) < 0.02);
  for (let n = 0; n < 45; n++) stepFlightPose(pose, p, 1 / 60);
  assert.ok(pose.bank.value > 0.15);
  p.vy = 12;
  p.pitch = 0.5;
  stepFlightPose(pose, p, 1 / 60);
  assert.ok(pose.pitch.value > -0.03);
  for (let n = 0; n < 45; n++) stepFlightPose(pose, p, 1 / 60);
  assert.ok(pose.pitch.value < -0.15);
  p.vy = -12;
  p.pitch = -0.5;
  const pitch = pose.pitch.value;
  stepFlightPose(pose, p, 1 / 60);
  assert.ok(Math.abs(pose.pitch.value - pitch) < 0.025);
});
test("animation weights crossfade, stay normalized, and reduced motion returns to neutral", () => {
  const p = makePilot("blend"),
    pose = createFlightPose(p);
  p.vy = 12;
  for (let n = 0; n < 60; n++) stepFlightPose(pose, p, 1 / 60);
  assert.ok(pose.weights.Ascend > 0.2);
  p.vy = -12;
  stepFlightPose(pose, p, 1 / 60);
  assert.ok(pose.weights.Ascend > 0.1, "outgoing clip must not be stopped");
  for (let n = 0; n < 60; n++) stepFlightPose(pose, p, 1 / 60, true);
  assert.ok(pose.weights.Flight > 0.99);
  assert.ok(Math.abs(pose.pitch.value) < 0.001);
  assert.ok(Math.abs(pose.bank.value) < 0.001);
  assert.ok(
    Math.abs(
      FLIGHT_CLIPS.reduce((sum, key) => sum + pose.weights[key], 0) - 1,
    ) < 1e-6,
  );
});
test("pose and spring remain stable through a long frame, with bounded network extrapolation", () => {
  const p = makePilot("stall");
  p.vx = 20;
  const pose = createFlightPose(p);
  stepFlightPose(pose, p, 0.25, false, 20);
  assert.ok(
    Object.values(pose)
      .filter((v) => typeof v === "number")
      .every(Number.isFinite),
  );
  assert.ok(pose.x < 2, "extrapolation must stop after 80ms");
  const state = { value: 0, velocity: 0 };
  spring(state, 0.4, 10, 0.25);
  assert.ok(state.value > 0 && state.value <= 0.4);
  assert.ok(Number.isFinite(state.velocity));
});
