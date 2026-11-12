import { controlYaw } from "../../../../packages/shared/aerodynamics.ts";
import {
  neutralInput,
  type FlightInput,
} from "../../../../packages/shared/index.ts";
import {
  attackSign,
  distance,
  normalized,
  opponent,
  type Vec3,
  type MatchAction,
} from "../../../../packages/shared/match.ts";
import { angleDelta, clamp } from "../../../../packages/shared/motion.ts";
import type { MatchSimulation, MatchMember } from "./match.ts";
function steer(m: MatchMember, target: Vec3, boost = false): FlightInput {
  const p = m.pilot,
    dx = target.x - p.x,
    dz = target.z - p.z,
    dy = target.y - p.y,
    range = Math.hypot(dx, dz);
  const aimX = dx - p.vx * 0.32,
    aimZ = dz - p.vz * 0.32,
    yaw = range > 1 ? Math.atan2(aimX, aimZ) : p.yaw;
  const error = Math.abs(angleDelta(p.yaw, yaw)),
    speed = Math.hypot(p.vx, p.vz);
  let forward = range > 14 ? 1 : range > 6 ? 0.65 : range > 2 ? 0.25 : -0.6;
  if (range < speed * 0.42 + 2) forward = -0.7;
  if (error > 0.9 && speed > 5) forward = -0.5;
  const lift = clamp(dy * 0.24 - p.vy * 0.3, -1, 1);
  return {
    ...neutralInput(),
    forward,
    lift,
    yaw: controlYaw(p, yaw),
    pitch: 0,
    boost: boost && range > 15 && error < 0.5 && p.energy > 22,
    seq: p.seq + 1,
  };
}
export function decideBot(
  game: MatchSimulation,
  m: MatchMember,
): { input: FlightInput; action?: MatchAction } {
  const p = m.pilot,
    sign = attackSign(p.team),
    ball = game.ball,
    owner = ball.owner ? game.players.get(ball.owner) : undefined;
  const index = game
    .teamMembers(p.team)
    .filter((x) => x.pilot.role === p.role)
    .findIndex((x) => x.pilot.id === p.id);
  let target: Vec3 = { x: (index - 1) * 15, y: 16, z: sign * 5 };
  let action: MatchAction | undefined;
  const act = (type: MatchAction["type"], aim?: Vec3) => {
    action = { id: game.tick + 1, type, aim };
  };
  if (p.recovery > 0.3) {
    m.state = "Recover";
    return { input: steer(m, { x: p.x, y: Math.max(8, p.y), z: p.z }) };
  }
  if (p.role === "Seeker") {
    m.state = "PursueTarget";
    const t = game.target;
    target =
      t.state === "hidden"
        ? { x: 24 * Math.sin(game.elapsed * 0.08), y: 29, z: sign * 30 }
        : { x: t.x + t.vx * 0.45, y: t.y + t.vy * 0.4, z: t.z + t.vz * 0.45 };
    if (t.state === "catchable" && distance(p, t) < 3) act("catch");
  } else if (p.role === "Keeper") {
    m.state = "Defend";
    const incoming = ball.vz * sign < 0 && ball.mode === "thrown";
    const t = incoming
      ? clamp((-sign * 74 - ball.z) / (ball.vz || 1), 0, 2)
      : 0;
    target = {
      x: clamp(ball.x + ball.vx * t, -14, 14),
      y: clamp(ball.y + ball.vy * t, 14, 24),
      z: -sign * 73,
    };
    if (owner === m) {
      m.state = "Pass";
      act("pass");
    } else if (distance(p, ball) < 7 && ball.mode === "thrown") act("block");
  } else if (p.role === "Warden") {
    m.state = "Protect";
    const hazard = [...game.hazards].sort(
      (a, b) => distance(p, a) - distance(p, b),
    )[0];
    const carrier =
      owner?.pilot.team === p.team
        ? owner.pilot
        : game.teamMembers(p.team).find((x) => x.pilot.role === "Striker")!
            .pilot;
    target = {
      x: clamp(carrier.x + (index === 0 ? -8 : 8), -42, 42),
      y: carrier.y + 2,
      z: carrier.z - sign * 5,
    };
    if (distance(p, hazard) < 6) {
      const enemy = game
        .teamMembers(opponent(p.team))
        .sort((a, b) => distance(p, a.pilot) - distance(p, b.pilot))[0];
      act(
        "strike",
        normalized({
          x: enemy.pilot.x - p.x,
          y: enemy.pilot.y - p.y,
          z: enemy.pilot.z - p.z,
        }),
      );
    } else if (distance(p, hazard) < 10) act("block");
  } else {
    if (owner === m) {
      m.state = "Carry";
      const keeper = game
        .teamMembers(opponent(p.team))
        .find((x) => x.pilot.role === "Keeper")!.pilot;
      const lanes = [-12, 0, 12].sort(
        (a, b) => Math.abs(b - keeper.x) - Math.abs(a - keeper.x),
      );
      const lane =
        lanes[(Math.max(0, index) + Math.floor(game.elapsed / 18)) % 2];
      const y = lane === 0 ? 22 : 17;
      target = { x: lane, y, z: sign * 53 };
      const goal = { x: lane, y, z: sign * 79 },
        range = distance(p, goal),
        bearing = Math.atan2(goal.x - p.x, goal.z - p.z);
      if (range < 37 && Math.abs(angleDelta(p.yaw, bearing)) < 0.7) {
        m.state = "Shoot";
        const travel = range / 34;
        act("shoot", {
          x: goal.x - p.x,
          y: goal.y - (p.y + 0.7) + 0.65 * travel * travel,
          z: goal.z - p.z,
        });
      } else if (Math.hypot(p.vx, p.vz) < 3 && game.elapsed % 13 < 0.15)
        act("pass");
    } else {
      const chase = owner?.pilot.team !== p.team;
      const rivals = game
        .teamMembers(p.team)
        .filter((x) => x.pilot.role === "Striker")
        .sort(
          (a, b) =>
            distance(a.pilot, owner?.pilot || ball) -
            distance(b.pilot, owner?.pilot || ball),
        );
      if (chase && rivals.indexOf(m) < 2) {
        m.state = "ChaseBall";
        const b = owner?.pilot || ball;
        target = {
          x: b.x + ("vx" in b ? b.vx : 0) * 0.2,
          y: b.y,
          z: b.z + ("vz" in b ? b.vz : 0) * 0.2,
        };
        if (distance(p, b) < 3) act("interact");
      } else {
        m.state = "Formation";
        const b = owner?.pilot || ball;
        target = {
          x: clamp(b.x + (index - 1) * 12, -38, 38),
          y: 16 + (index % 2) * 3,
          z: clamp(b.z - sign * 10, -55, 55),
        };
      }
    }
  }
  return {
    input: steer(m, target, p.role === "Seeker" || m.state === "ChaseBall"),
    action,
  };
}
