import { advanceAerodynamics } from "./aerodynamics.ts";
export type Team = "auric" | "verdant";
export type Role = "Striker" | "Warden" | "Keeper" | "Seeker";
export type FlightInput = {
  forward: number;
  strafe: number;
  lift: number;
  yaw: number;
  pitch: number;
  boost: boolean;
  seq: number;
  quickTurn?: boolean;
};
export type Pilot = {
  id: string;
  name: string;
  bot?: boolean;
  team: Team;
  role: Role;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  energy: number;
  seq: number;
  recovery: number;
  forwardAxis: number;
  strafeAxis: number;
  liftAxis: number;
  boostBlend: number;
  simTime: number;
  airSpeed: number;
  pressure: number;
  windX: number;
  windY: number;
  windZ: number;
  loadFactor: number;
  acceleration: number;
  bank: number;
  bankVelocity: number;
  rollLoad: number;
  turnRemaining: number;
  turnCooldown: number;
  turnCount: number;
  turnStartYaw: number;
  turnTargetYaw: number;
  turnSign: number;
  turnHeld: boolean;
};
export const CAPACITY: Record<Role, number> = {
  Striker: 3,
  Warden: 2,
  Keeper: 1,
  Seeker: 1,
};
export const RULESET = {
  duration: 600,
  goalPoints: 10,
  catchPoints: 30,
  catchEndsMatch: true,
};
export const neutralInput = (): FlightInput => ({
  forward: 0,
  strafe: 0,
  lift: 0,
  yaw: 0,
  pitch: 0,
  boost: false,
  quickTurn: false,
  seq: 0,
});
export function validInput(v: unknown): v is FlightInput {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    ["forward", "strafe", "lift"].every(
      (k) =>
        typeof p[k] === "number" &&
        Number.isFinite(p[k]) &&
        Math.abs(p[k] as number) <= 1,
    ) &&
    ["yaw", "pitch"].every(
      (k) =>
        typeof p[k] === "number" &&
        Number.isFinite(p[k]) &&
        Math.abs(p[k] as number) <= Math.PI * 2,
    ) &&
    typeof p.boost === "boolean" &&
    (p.quickTurn === undefined || typeof p.quickTurn === "boolean") &&
    Number.isSafeInteger(p.seq) &&
    Number(p.seq) >= 0
  );
}
export function makePilot(
  id: string,
  name = "Pilot",
  team: Team = "auric",
): Pilot {
  return {
    id,
    name,
    team,
    role: "Striker",
    x: 0,
    y: 13,
    z: -25,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    energy: 100,
    recovery: 0,
    forwardAxis: 0,
    strafeAxis: 0,
    liftAxis: 0,
    boostBlend: 0,
    simTime: 0,
    airSpeed: 0,
    pressure: 0,
    windX: 0,
    windY: 0,
    windZ: 0,
    loadFactor: 1,
    acceleration: 0,
    bank: 0,
    bankVelocity: 0,
    rollLoad: 0,
    turnRemaining: 0,
    turnCooldown: 0,
    turnCount: 0,
    turnStartYaw: 0,
    turnTargetYaw: 0,
    turnSign: 1,
    turnHeld: false,
    seq: 0,
  };
}
export function stepFlight(
  p: Pilot,
  i: FlightInput,
  dt: number,
  worldTime?: number,
) {
  advanceAerodynamics(p, i, dt, worldTime);
  const boundary = (p.x * p.x) / (54 * 54) + (p.z * p.z) / (100 * 100);
  if (boundary > 1) {
    const s = (1 - 1e-12) / Math.sqrt(boundary);
    p.x *= s;
    p.z *= s;
    p.vx *= 0.3;
    p.vz *= 0.3;
    p.recovery = 0.55;
  }
  if (p.y < 3) {
    p.y = 3;
    p.vy = Math.max(0, p.vy);
    p.recovery = 0.35;
  }
  if (p.y > 49) {
    p.y = 49;
    p.vy = Math.min(0, p.vy);
  }
  for (const side of [-1, 1])
    for (let ring = -1; ring <= 1; ring++) {
      const x = ring * 12,
        z = side * 79,
        height = ring === 0 ? 22 : 17;
      const dx = p.x - x,
        dz = p.z - z,
        distance = Math.hypot(dx, dz);
      if (p.y < height && distance < 0.7) {
        const nx = distance > 0.001 ? dx / distance : 1,
          nz = distance > 0.001 ? dz / distance : 0;
        p.x = x + nx * 0.7;
        p.z = z + nz * 0.7;
        const inward = p.vx * nx + p.vz * nz;
        if (inward < 0) {
          p.vx -= inward * nx * 1.25;
          p.vz -= inward * nz * 1.25;
        }
        p.recovery = 0.45;
      }
    }
}
export function canSelect(pilots: Pilot[], id: string, team: Team, role: Role) {
  return (
    pilots.filter((p) => p.id !== id && p.team === team && p.role === role)
      .length < CAPACITY[role]
  );
}
export function validInvite(actual: string, value: unknown) {
  return (
    typeof value === "string" &&
    value.length === actual.length &&
    actual === value
  );
}
export function safeName(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .slice(0, 20) || "Pilot"
    : "Pilot";
}
