import type { Pilot } from "../../../../packages/shared/index.ts";
import {
  angleDelta,
  clamp,
  damp,
  dampAngle,
  spring,
  type Spring,
} from "../../../../packages/shared/motion.ts";
export const FLIGHT_CLIPS = [
  "Flight",
  "Boost",
  "Brake",
  "Ascend",
  "Descend",
  "BankLeft",
  "BankRight",
  "Recover",
] as const;
export type FlightClip = (typeof FLIGHT_CLIPS)[number];
export type ClipWeights = Record<FlightClip, number>;
export type FlightPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: Spring;
  bank: Spring;
  turnRate: number;
  verticalSpeed: number;
  forwardSpeed: number;
  weights: ClipWeights;
  torsoLean: Spring;
};
export function createFlightPose(p: Pilot): FlightPose {
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: { value: 0, velocity: 0 },
    bank: { value: 0, velocity: 0 },
    turnRate: 0,
    torsoLean: { value: 0, velocity: 0 },
    verticalSpeed: p.vy,
    forwardSpeed: 0,
    weights: {
      Flight: 1,
      Boost: 0,
      Brake: 0,
      Ascend: 0,
      Descend: 0,
      BankLeft: 0,
      BankRight: 0,
      Recover: 0,
    },
  };
}
export function blendWeights(
  weights: ClipWeights,
  target: ClipWeights,
  dt: number,
) {
  for (const clip of FLIGHT_CLIPS)
    weights[clip] = damp(weights[clip], target[clip], 10, dt);
}
export function stepFlightPose(
  pose: FlightPose,
  p: Pilot,
  dt: number,
  reducedMotion = false,
  snapshotAge = 0,
) {
  if (dt <= 0) return;
  dt = Math.min(dt, 0.25);
  const horizon = p.recovery > 0 ? 0 : clamp(snapshotAge, 0, 0.08);
  const target = {
    x: p.x + p.vx * horizon,
    y: clamp(p.y + p.vy * horizon, 3, 49),
    z: p.z + p.vz * horizon,
  };
  const boundary =
    (target.x * target.x) / (54 * 54) + (target.z * target.z) / (100 * 100);
  if (boundary > 1) {
    const scale = 1 / Math.sqrt(boundary);
    target.x *= scale;
    target.z *= scale;
  }
  const distance = Math.hypot(
    target.x - pose.x,
    target.y - pose.y,
    target.z - pose.z,
  );
  // Legitimate respawn / reconnect discontinuities should not fly through the arena.
  if (distance > 15) {
    pose.x = p.x;
    pose.y = p.y;
    pose.z = p.z;
    pose.yaw = p.yaw;
    pose.turnRate = 0;
    pose.bank = { value: 0, velocity: 0 };
    pose.pitch = { value: 0, velocity: 0 };
    pose.torsoLean = { value: 0, velocity: 0 };
  }
  pose.x = damp(pose.x, target.x, 22, dt);
  pose.y = damp(pose.y, target.y, 22, dt);
  pose.z = damp(pose.z, target.z, 22, dt);
  const previousYaw = pose.yaw;
  pose.yaw = dampAngle(pose.yaw, p.yaw, 16, dt);
  pose.turnRate = damp(
    pose.turnRate,
    angleDelta(previousYaw, pose.yaw) / dt,
    9,
    dt,
  );
  const speed = Math.hypot(p.vx, p.vz);
  const forward = Math.sin(pose.yaw) * p.vx + Math.cos(pose.yaw) * p.vz;
  const acceleration = clamp((forward - pose.forwardSpeed) / dt, -45, 45);
  pose.forwardSpeed = damp(pose.forwardSpeed, forward, 12, dt);
  pose.verticalSpeed = damp(pose.verticalSpeed, p.vy, 10, dt);
  const buffet =
    Math.min(0.018, p.pressure / 70000) * Math.sin(p.simTime * 13.7);
  const bank = clamp(p.bank + buffet, -1.16, 1.16);
  const pitch = clamp(
    -p.pitch * 0.65 -
      Math.atan2(pose.verticalSpeed, Math.max(13, speed)) * 0.18 -
      acceleration * 0.0012,
    -0.72,
    0.72,
  );
  const previousBank = pose.bank.value,
    previousPitch = pose.pitch.value;
  // Reduced motion suppresses automatic sway, not the player's deliberate A/D attitude.
  const showManualRoll = Math.abs(p.strafeAxis) > 0.001;
  spring(pose.bank, reducedMotion && !showManualRoll ? 0 : bank, 12, dt);
  spring(
    pose.torsoLean,
    reducedMotion ? 0 : clamp(-p.bankVelocity * 0.075, -0.11, 0.11),
    12,
    dt,
  );
  spring(pose.pitch, reducedMotion ? 0 : pitch, 11, dt);
  const bankRate = p.turnRemaining > 0 ? 5.5 : 2.8;
  pose.bank.value = clamp(
    pose.bank.value,
    previousBank - bankRate * dt,
    previousBank + bankRate * dt,
  );
  pose.bank.velocity = clamp(pose.bank.velocity, -bankRate, bankRate);
  pose.pitch.value = clamp(
    pose.pitch.value,
    previousPitch - 2.4 * dt,
    previousPitch + 2.4 * dt,
  );
  pose.pitch.velocity = clamp(pose.pitch.velocity, -2.4, 2.4);
  const raw: ClipWeights = {
    Flight: 1,
    Boost: clamp((speed - 23) / 10, 0, 1) * 1.7,
    Brake: p.forwardAxis < -0.1 && speed > 4 ? 0.45 : 0,
    Ascend: clamp(pose.verticalSpeed / 10, 0, 1),
    Descend: clamp(-pose.verticalSpeed / 10, 0, 1),
    BankLeft: clamp(pose.bank.value / 0.38, 0, 1),
    BankRight: clamp(-pose.bank.value / 0.38, 0, 1),
    Recover: p.recovery > 0 ? 0.6 : 0,
  };
  if (reducedMotion)
    for (const clip of FLIGHT_CLIPS) raw[clip] = clip === "Flight" ? 1 : 0;
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  for (const clip of FLIGHT_CLIPS) raw[clip] /= total;
  blendWeights(pose.weights, raw, dt);
}
