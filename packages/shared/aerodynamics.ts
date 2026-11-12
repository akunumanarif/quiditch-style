import type { FlightInput, Pilot } from "./index.ts";
import { angleDelta, clamp, damp, dampAngle } from "./motion.ts";
export const FLIGHT_PHYSICS = {
  massKg: 90,
  gravity: 9.81,
  dragArea: 2.8,
  thrust: 20,
  boostThrust: 36,
  maxSpeed: 52,
  turnDuration: 0.8,
  turnEnergy: 24,
  turnCooldown: 3,
  manualBankAngle: 0.96,
} as const;
export function sampleWind(x: number, y: number, z: number, time: number) {
  const altitude = 1 + clamp(y / 100, 0, 0.7);
  return {
    x:
      altitude *
      (2.2 +
        1.2 * Math.sin(time * 0.63 + z * 0.022) +
        0.45 * Math.sin(time * 2.1 + x * 0.04)),
    y: 0.32 * Math.sin(time * 1.4 + x * 0.035) * Math.sin(z * 0.018 + 0.6),
    z: altitude * (0.9 + 1.1 * Math.sin(time * 0.37 + x * 0.027)),
  };
}
export function dynamicPressure(speed: number, height = 0) {
  return 0.5 * 1.225 * Math.exp(-Math.max(0, height) / 8500) * speed * speed;
}
export function keyboardTurnRate(speed: number) {
  return 2.35 / (1 + Math.max(0, speed) * 0.025);
}
function step(p: Pilot, i: FlightInput, dt: number) {
  const cfg = FLIGHT_PHYSICS;
  p.simTime += dt;
  const oldVx = p.vx,
    oldVy = p.vy,
    oldVz = p.vz;
  const wind = sampleWind(p.x, p.y, p.z, p.simTime);
  p.windX = wind.x;
  p.windY = wind.y;
  p.windZ = wind.z;
  const rx = p.vx - wind.x,
    ry = p.vy - wind.y,
    rz = p.vz - wind.z;
  const airSpeed = Math.hypot(rx, ry, rz),
    horizontalSpeed = Math.hypot(p.vx, p.vz);
  p.forwardAxis = damp(p.forwardAxis, i.forward, 10, dt);
  p.strafeAxis = damp(p.strafeAxis, i.strafe, 9, dt);
  p.liftAxis = damp(p.liftAxis, i.lift, 9, dt);
  p.turnCooldown = Math.max(0, p.turnCooldown - dt);
  const requested = i.quickTurn === true;
  if (
    requested &&
    !p.turnHeld &&
    p.turnCooldown === 0 &&
    p.energy >= cfg.turnEnergy
  ) {
    p.turnCount++;
    p.turnRemaining = cfg.turnDuration;
    p.turnStartYaw = p.yaw;
    p.turnSign = i.strafe < 0 ? -1 : 1;
    p.turnTargetYaw = Math.atan2(
      Math.sin(p.yaw + p.turnSign * Math.PI),
      Math.cos(p.yaw + p.turnSign * Math.PI),
    );
    p.turnCooldown = cfg.turnCooldown;
    p.energy -= cfg.turnEnergy;
  }
  p.turnHeld = requested;
  const boosting = i.boost && p.energy > 2 && p.forwardAxis > 0;
  p.boostBlend = damp(p.boostBlend, boosting ? 1 : 0, 6, dt);
  const previousYaw = p.yaw;
  const turning = p.turnRemaining > 0;
  let turnDelta = 0,
    progress = 0;
  if (turning) {
    const before = 1 - p.turnRemaining / cfg.turnDuration;
    p.turnRemaining = Math.max(0, p.turnRemaining - dt);
    progress = 1 - p.turnRemaining / cfg.turnDuration;
    const ease = (t: number) => t * t * (3 - 2 * t);
    turnDelta = p.turnSign * Math.PI * (ease(progress) - ease(before));
    p.yaw = p.turnStartYaw + p.turnSign * Math.PI * ease(progress);
    p.yaw = Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw));
    // Controlled centripetal impulse: an energetic brake-and-pivot, never a position teleport.
    const cos = Math.cos(turnDelta),
      sin = Math.sin(turnDelta),
      loss = Math.exp(-0.95 * dt),
      vx = p.vx;
    p.vx = (vx * cos + p.vz * sin) * loss;
    p.vz = (p.vz * cos - vx * sin) * loss;
  } else p.yaw = dampAngle(p.yaw, i.yaw, 9, dt, keyboardTurnRate(airSpeed));
  const yawRate = angleDelta(previousYaw, p.yaw) / dt;
  const pitchTarget = clamp(i.pitch + p.liftAxis * 0.58, -1.03, 1.03);
  p.pitch = damp(p.pitch, pitchTarget, 6.5, dt);
  const heading = Math.atan2(p.vx, p.vz);
  const pressure = dynamicPressure(airSpeed, p.y),
    brake = Math.max(0, -p.forwardAxis);
  // A/D alone controls attitude. Positive throttle couples the actual bank into thrust below.
  const automaticBank = -Math.atan2(
    yawRate * horizontalSpeed * 0.35,
    cfg.gravity,
  );
  const rollTarget = turning
    ? -p.turnSign * Math.sin(Math.PI * progress) * 1.16
    : -p.strafeAxis * cfg.manualBankAngle +
      automaticBank * (1 - Math.abs(p.strafeAxis));
  const oldBankVelocity = p.bankVelocity;
  const stiffness = turning ? 60 : 44;
  const airDamping = 12 + clamp(pressure / 170, 0, 4);
  const torque = clamp(
    (clamp(rollTarget, -1.16, 1.16) - p.bank) * stiffness -
      p.bankVelocity * airDamping,
    -14,
    14,
  );
  p.bankVelocity = clamp(
    p.bankVelocity + torque * dt,
    turning ? -5.5 : -2.1,
    turning ? 5.5 : 2.1,
  );
  p.bank = clamp(p.bank + p.bankVelocity * dt, -1.16, 1.16);
  p.rollLoad = damp(
    p.rollLoad,
    ((Math.abs(p.bankVelocity - oldBankVelocity) / dt) * 0.65) / cfg.gravity,
    12,
    dt,
  );
  // Redirect the same thrust magnitude toward the lean; never add a separate strafe impulse.
  // Mouse/arrow heading and Q remain independent of A/D attitude input.
  const bankDeflection = turning
    ? 0
    : p.bank * Math.min(1, Math.abs(p.strafeAxis)) * Math.max(0, p.forwardAxis);
  const travelYaw = p.yaw - bankDeflection;
  const headingError = angleDelta(heading, travelYaw);
  const turnAcceleration = turning
    ? 0
    : clamp(headingError * horizontalSpeed * 2.5, -18, 18);
  const drag = ((pressure * cfg.dragArea) / cfg.massKg) * (1 + brake * 3.5);
  const dragRate = drag / Math.max(airSpeed, 0.1) + 0.1 + brake * 1.5;
  const thrust =
    (cfg.thrust + (cfg.boostThrust - cfg.thrust) * p.boostBlend) *
    Math.max(0, p.forwardAxis) *
    (turning ? 0.12 : 1);
  const forwardX = Math.sin(travelYaw) * Math.cos(p.pitch),
    forwardZ = Math.cos(travelYaw) * Math.cos(p.pitch);
  // Magical suspension supports hovering. In pitched fast flight gravity again trades speed for altitude.
  const speedBlend = clamp(horizontalSpeed / 18, 0, 1);
  const support =
    cfg.gravity * (1 - 0.6 * Math.abs(Math.sin(p.pitch)) * speedBlend);
  const hoverControl = p.liftAxis * 16 * (1 - 0.8 * speedBlend);
  const verticalDamping = 0.85 * (1 - speedBlend) + 0.1;
  const ax =
    forwardX * thrust - rx * dragRate + Math.cos(heading) * turnAcceleration;
  const ay =
    Math.sin(p.pitch) * thrust +
    support -
    cfg.gravity +
    hoverControl -
    ry * dragRate -
    p.vy * verticalDamping;
  const az =
    forwardZ * thrust - rz * dragRate - Math.sin(heading) * turnAcceleration;
  p.vx += ax * dt;
  p.vy += ay * dt;
  p.vz += az * dt;
  const speed = Math.hypot(p.vx, p.vy, p.vz);
  if (speed > cfg.maxSpeed) {
    const scale = cfg.maxSpeed / speed;
    p.vx *= scale;
    p.vy *= scale;
    p.vz *= scale;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  p.airSpeed = Math.hypot(p.vx - wind.x, p.vy - wind.y, p.vz - wind.z);
  p.pressure = dynamicPressure(p.airSpeed, p.y);
  p.loadFactor =
    Math.hypot(
      (p.vx - oldVx) / dt,
      (p.vy - oldVy) / dt + cfg.gravity,
      (p.vz - oldVz) / dt,
    ) / cfg.gravity;
  p.acceleration = damp(p.acceleration, Math.hypot(ax, ay, az), 8, dt);
  p.energy = clamp(
    p.energy +
      (boosting ? -20 : 10) * dt -
      Math.max(0, p.loadFactor - 1.6) * 0.65 * dt,
    0,
    100,
  );
  p.recovery = Math.max(0, p.recovery - dt);
  p.seq = i.seq;
}
export function advanceAerodynamics(
  p: Pilot,
  i: FlightInput,
  dt: number,
  worldTime?: number,
) {
  dt = clamp(dt, 0, 0.05);
  if (dt === 0) return;
  if (worldTime !== undefined) p.simTime = worldTime;
  const steps = Math.ceil(dt * 120),
    h = dt / steps;
  for (let n = 0; n < steps; n++) step(p, i, h);
}
