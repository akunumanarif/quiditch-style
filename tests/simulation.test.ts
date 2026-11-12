import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makePilot,
  stepFlight,
  neutralInput,
  validInput,
  canSelect,
  validInvite,
  safeName,
  CAPACITY,
} from "../packages/shared/index.ts";
test("rejects malformed, nonfinite and teleport inputs", () => {
  for (const v of [
    null,
    {},
    { ...neutralInput(), forward: 2 },
    { ...neutralInput(), yaw: NaN },
    { ...neutralInput(), seq: -1 },
    { ...neutralInput(), boost: 1 },
  ])
    assert.equal(validInput(v), false);
  assert.equal(validInput(neutralInput()), true);
});
test("flight accelerates, bounds speed and stays inside stadium", () => {
  const p = makePilot("a");
  const i = { ...neutralInput(), forward: 1, boost: true };
  for (let n = 0; n < 10000; n++) stepFlight(p, i, 1 / 30);
  assert.ok(p.z <= 100);
  assert.ok(p.y >= 3 && p.y <= 49);
  assert.ok(Math.hypot(p.vx, p.vy, p.vz) <= 52.001);
  assert.ok(p.energy >= 0 && p.energy <= 100);
});
test("stamina drains and recovers; braking is stable", () => {
  const p = makePilot("a");
  for (let n = 0; n < 50; n++)
    stepFlight(p, { ...neutralInput(), forward: 1, boost: true }, 1 / 30);
  assert.ok(p.energy < 70);
  const before = p.vz;
  for (let n = 0; n < 100; n++)
    stepFlight(p, { ...neutralInput(), forward: -1 }, 1 / 30);
  assert.ok(Math.abs(p.vz) < before * 0.2);
  assert.ok(p.energy > 70);
});
test("each team has exactly seven role slots; capacity cannot be exceeded", () => {
  assert.equal(
    Object.values(CAPACITY).reduce((a, b) => a + b),
    7,
  );
  const p = makePilot("a");
  p.role = "Keeper";
  assert.equal(canSelect([p], "b", "auric", "Keeper"), false);
  assert.equal(canSelect([p], "a", "auric", "Keeper"), true);
  assert.equal(canSelect([p], "b", "verdant", "Keeper"), true);
});
test("invites must match the whole opaque token", () => {
  assert.ok(validInvite("opaque-secret", "opaque-secret"));
  for (const bad of [null, {}, "opaque", "wrong-secret", ""])
    assert.equal(validInvite("opaque-secret", bad), false);
});
test("display names are bounded and strip markup", () => {
  assert.equal(safeName("<script>alert(1)</script>").includes("<"), false);
  assert.equal(safeName("a".repeat(100)).length, 20);
  assert.equal(safeName(null), "Pilot");
});
