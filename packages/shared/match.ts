import type { Pilot, Role, Team } from "./index.ts";
export type Vec3 = { x: number; y: number; z: number };
export type MatchPhase = "LOBBY" | "COUNTDOWN" | "LIVE" | "ENDED";
export type Ball = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  owner: string | null;
  mode: "free" | "carried" | "thrown" | "reset";
  age: number;
  lastTouch: string | null;
  lastTeam: Team | null;
};
export type Hazard = Vec3 & {
  vx: number;
  vy: number;
  vz: number;
  id: string;
  team: Team | null;
  grace: number;
  lastHit: string | null;
};
export type GoldenTarget = Vec3 & {
  vx: number;
  vy: number;
  vz: number;
  state: "hidden" | "cruising" | "evading" | "catchable" | "captured";
  captor: string | null;
};
export type BotState =
  | "Formation"
  | "ChaseBall"
  | "Carry"
  | "Pass"
  | "Shoot"
  | "Defend"
  | "PursueTarget"
  | "Protect"
  | "Recover";
export type MemberView = {
  id: string;
  name: string;
  team: Team;
  role: Role;
  bot: boolean;
  connected: boolean;
  ready: boolean;
  state: BotState;
  goals: number;
  passes: number;
  catches: number;
};
export type MatchEvent = {
  id: number;
  type: "goal" | "catch" | "start" | "end" | "steal" | "block" | "hazard";
  text: string;
  time: number;
  team?: Team;
};
export type MatchSnapshot = {
  phase: MatchPhase;
  hostId: string;
  duration: number;
  remaining: number;
  countdown: number;
  scores: Record<Team, number>;
  winner: Team | "draw" | null;
  reason: string;
  roster: MemberView[];
  ball: Ball;
  hazards: Hazard[];
  target: GoldenTarget;
  events: MatchEvent[];
};
export type MatchAction = {
  id: number;
  type: "interact" | "shoot" | "pass" | "block" | "strike" | "catch";
  aim?: Vec3;
};
export const ROLE_ORDER: Role[] = [
  "Striker",
  "Striker",
  "Striker",
  "Warden",
  "Warden",
  "Keeper",
  "Seeker",
];
export const attackSign = (team: Team) => (team === "auric" ? 1 : -1);
export const opponent = (team: Team): Team =>
  team === "auric" ? "verdant" : "auric";
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function validAction(value: unknown): value is MatchAction {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(a.id) ||
    Number(a.id) < 0 ||
    !["interact", "shoot", "pass", "block", "strike", "catch"].includes(
      String(a.type),
    )
  )
    return false;
  if (a.aim !== undefined) {
    if (!a.aim || typeof a.aim !== "object") return false;
    const v = a.aim as Record<string, unknown>;
    if (
      !["x", "y", "z"].every(
        (k) =>
          typeof v[k] === "number" &&
          Number.isFinite(v[k]) &&
          Math.abs(v[k] as number) <= 10000,
      )
    )
      return false;
    if (Math.hypot(Number(v.x), Number(v.y), Number(v.z)) < 0.001) return false;
  }
  return true;
}
export function viewDirection(p: Pilot): Vec3 {
  return {
    x: Math.sin(p.yaw) * Math.cos(p.pitch),
    y: Math.sin(p.pitch),
    z: Math.cos(p.yaw) * Math.cos(p.pitch),
  };
}
export function normalized(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}
/** Front-to-back swept crossing through one of the six open ring interiors. */
export function crossedGoal(previous: Vec3, next: Vec3): Team | null {
  for (const side of [-1, 1]) {
    const z = side * 79;
    if ((previous.z - z) * side >= 0 || (next.z - z) * side < 0) continue;
    const t = (z - previous.z) / (next.z - previous.z),
      x = previous.x + (next.x - previous.x) * t,
      y = previous.y + (next.y - previous.y) * t;
    for (const lane of [-1, 0, 1])
      if (Math.hypot(x - lane * 12, y - (lane === 0 ? 22 : 17)) < 3.15)
        return side > 0 ? "auric" : "verdant";
  }
  return null;
}
