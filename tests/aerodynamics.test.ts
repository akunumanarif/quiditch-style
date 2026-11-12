import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makePilot,
  neutralInput,
  stepFlight,
  validInput,
  type Pilot,
  type FlightInput,
} from "../packages/shared/index.ts";
import {
  dynamicPressure,
  sampleWind,
  FLIGHT_PHYSICS,
} from "../packages/shared/aerodynamics.ts";
import { angleDelta } from "../packages/shared/motion.ts";
const run = (p: Pilot, i: FlightInput, seconds: number) => {
  for (let n = 0; n < Math.round(seconds * 120); n++) stepFlight(p, i, 1 / 120);
};
const speed = (p: Pilot) => Math.hypot(p.vx, p.vy, p.vz);
test("air pressure scales with relative airspeed squared and wind is reproducible", () => {
  assert.equal(dynamicPressure(30) / dynamicPressure(15), 4);
  assert.equal(dynamicPressure(0), 0);
  assert.deepEqual(sampleWind(1, 20, 3, 4), sampleWind(1, 20, 3, 4));
  assert.notDeepEqual(sampleWind(1, 20, 3, 4), sampleWind(1, 20, 3, 6));
});
test("releasing thrust preserves momentum; active airbraking dissipates it", () => {
  const p = makePilot("coast");
  run(p, { ...neutralInput(), forward: 1 }, 2);
  p.z = -30;
  const coast = { ...p },
    brake = { ...p },
    initial = speed(p);
  run(coast, neutralInput(), 0.5);
  run(brake, { ...neutralInput(), forward: -1 }, 0.5);
  assert.ok(speed(coast) > initial * 0.6);
  assert.ok(speed(coast) < initial);
  assert.ok(speed(brake) < speed(coast) * 0.7);
  assert.ok(coast.z > -29);
});
test("diving gains speed while climbing spends it, without snapping vertical velocity", () => {
  const up = makePilot("up"),
    down = makePilot("down");
  for (const p of [up, down]) {
    p.y = 30;
    p.z = 0;
    p.vz = 22;
  }
  run(up, { ...neutralInput(), forward: 1, pitch: 0.55 }, 1);
  run(down, { ...neutralInput(), forward: 1, pitch: -0.55 }, 1);
  assert.ok(up.vy > 0 && down.vy < 0);
  assert.ok(down.airSpeed > up.airSpeed + 0.5);
  assert.ok(up.y > 30 && down.y < 30);
});
test("normal steering banks and retains inertia instead of rotating velocity instantly", () => {
  const p = makePilot("bank");
  p.vz = 25;
  p.z = -20;
  stepFlight(p, { ...neutralInput(), forward: 1, yaw: Math.PI / 2 }, 1 / 60);
  assert.ok(p.vz > 24);
  assert.ok(Math.abs(p.vx) < 1);
  run(p, { ...neutralInput(), forward: 1, yaw: Math.PI / 2 }, 0.5);
  assert.ok(p.bank < -0.1);
  assert.ok(p.loadFactor > 1);
});
test("quick turn reverses heading and travel in 0.8s with energy, speed loss and a real arc", () => {
  const p = makePilot("turn");
  p.y = 25;
  p.z = 0;
  p.vz = 25;
  run(p, { ...neutralInput(), quickTurn: true, yaw: Math.PI }, 0.8 + 1 / 120);
  assert.equal(p.turnCount, 1);
  assert.ok(Math.abs(angleDelta(p.yaw, Math.PI)) < 0.01);
  assert.ok(p.vz < 0);
  assert.ok(speed(p) < 25 * 0.65);
  assert.ok(p.energy < 90);
  assert.ok(p.turnCooldown > 2);
  assert.ok(Math.hypot(p.x, p.z) > 1 && Math.hypot(p.x, p.z) < 20);
  assert.equal(p.turnRemaining, 0);
});
test("held/spammed quick turn cannot bypass cooldown or energy, and accepts left-hand turns", () => {
  const p = makePilot("cooldown");
  const command = { ...neutralInput(), quickTurn: true, yaw: Math.PI };
  run(p, command, 3.5);
  assert.equal(p.turnCount, 1);
  run(p, neutralInput(), 0.05);
  stepFlight(p, { ...command, strafe: -1 }, 1 / 120);
  assert.equal(p.turnCount, 2);
  assert.equal(p.turnSign, -1);
  const poor = makePilot("poor");
  poor.energy = 3;
  stepFlight(poor, command, 1 / 60);
  assert.equal(poor.turnCount, 0);
  assert.equal(validInput({ ...neutralInput(), quickTurn: "yes" }), false);
});
test("wind forces, load and pressure stay finite and speed stays bounded in prolonged maneuvering", () => {
  const p = makePilot("stress");
  for (let n = 0; n < 3000; n++)
    stepFlight(
      p,
      {
        ...neutralInput(),
        forward: 1,
        boost: true,
        lift: Math.sin(n * 0.01),
        yaw: Math.sin(n * 0.006) * Math.PI,
        pitch: Math.sin(n * 0.003) * 0.7,
        quickTurn: n % 240 === 0,
      },
      1 / 60,
    );
  assert.ok(
    [p.pressure, p.airSpeed, p.loadFactor, p.bank, p.vx, p.vy, p.vz].every(
      Number.isFinite,
    ),
  );
  assert.ok(speed(p) <= FLIGHT_PHYSICS.maxSpeed + 0.001);
  assert.ok(p.y >= 3 && p.y <= 49);
});
