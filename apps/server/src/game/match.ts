import {
  CAPACITY,
  RULESET,
  makePilot,
  neutralInput,
  stepFlight,
  validInput,
  canSelect,
  type FlightInput,
  type Pilot,
  type Role,
  type Team,
} from "../../../../packages/shared/index.ts";
import {
  attackSign,
  crossedGoal,
  distance,
  normalized,
  ROLE_ORDER,
  validAction,
  viewDirection,
  type Ball,
  type BotState,
  type GoldenTarget,
  type Hazard,
  type MatchEvent,
  type MatchSnapshot,
  type Vec3,
} from "../../../../packages/shared/match.ts";
import { segmentDistance } from "../../../../packages/shared/flight-course.ts";
import { clamp } from "../../../../packages/shared/motion.ts";
import { decideBot } from "./bots.ts";
export type MatchMember = {
  pilot: Pilot;
  bot: boolean;
  connected: boolean;
  ready: boolean;
  state: BotState;
  goals: number;
  passes: number;
  catches: number;
  cooldown: number;
  blockUntil: number;
  lastActionId: number;
  input: FlightInput;
  lastInputAt: number;
};
const freshBall = (): Ball => ({
  x: 0,
  y: 15,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  owner: null,
  mode: "free",
  age: 0,
  lastTouch: null,
  lastTeam: null,
});
const BOT_NAMES = ["Ash", "Briar", "Cove", "Dune", "Elm", "Flint", "Gale"];
export class MatchSimulation {
  readonly players = new Map<string, MatchMember>();
  phase: MatchSnapshot["phase"] = "LOBBY";
  hostId = "";
  duration: number;
  elapsed = 0;
  countdown = 3;
  tick = 0;
  scores: Record<Team, number> = { auric: 0, verdant: 0 };
  winner: Team | "draw" | null = null;
  reason = "";
  ball = freshBall();
  hazards: Hazard[] = [
    {
      id: "hazard-0",
      x: -22,
      y: 17,
      z: 10,
      vx: 0,
      vy: 0,
      vz: 9,
      team: null,
      grace: 0,
      lastHit: null,
    },
    {
      id: "hazard-1",
      x: 22,
      y: 20,
      z: -10,
      vx: 0,
      vy: 0,
      vz: -9,
      team: null,
      grace: 0,
      lastHit: null,
    },
  ];
  target: GoldenTarget = {
    x: 20,
    y: 28,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    state: "hidden",
    captor: null,
  };
  readonly events: MatchEvent[] = [];
  private eventId = 0;
  private clock = 0;
  private resetTimer = 0;
  private targetEnabled: boolean;
  constructor(options: { duration?: number; targetEnabled?: boolean } = {}) {
    this.duration = options.duration ?? RULESET.duration;
    this.targetEnabled = options.targetEnabled !== false;
  }
  teamMembers(team: Team) {
    return [...this.players.values()].filter((m) => m.pilot.team === team);
  }
  private member(pilot: Pilot, bot: boolean): MatchMember {
    return {
      pilot,
      bot,
      connected: true,
      ready: bot,
      state: "Formation",
      goals: 0,
      passes: 0,
      catches: 0,
      cooldown: 0,
      blockUntil: 0,
      lastActionId: -1,
      input: neutralInput(),
      lastInputAt: 0,
    };
  }
  private spawn(m: MatchMember, index: number) {
    const sign = attackSign(m.pilot.team);
    const role = m.pilot.role;
    const positions: Record<Role, Vec3> = {
      Striker: { x: (index - 1) * 13, y: 17, z: -sign * 24 },
      Warden: { x: index === 0 ? -20 : 20, y: 20, z: -sign * 39 },
      Keeper: { x: 0, y: 21, z: -sign * 73 },
      Seeker: { x: 26, y: 29, z: -sign * 20 },
    };
    const spot = positions[role];
    Object.assign(m.pilot, makePilot(m.pilot.id, m.pilot.name, m.pilot.team), {
      role,
      bot: m.bot,
      ...spot,
      yaw: sign > 0 ? 0 : Math.PI,
    });
    m.input = { ...neutralInput(), yaw: m.pilot.yaw };
    m.cooldown = 0;
    m.blockUntil = 0;
    m.lastActionId = -1;
  }
  fillBots() {
    for (const [id, m] of this.players) if (m.bot) this.players.delete(id);
    for (const team of ["auric", "verdant"] as Team[]) {
      let slot = 0;
      for (const role of ROLE_ORDER) {
        const count = this.teamMembers(team).filter(
          (m) => m.pilot.role === role,
        ).length;
        if (count < CAPACITY[role]) {
          const id = `bot-${team}-${slot}`;
          const p = makePilot(
            id,
            `${BOT_NAMES[slot]} ${team === "auric" ? "A" : "V"}`,
            team,
          );
          p.role = role;
          const m = this.member(p, true);
          this.players.set(id, m);
        }
        slot++;
      }
      const seen = new Map<Role, number>();
      for (const m of this.teamMembers(team)) {
        const index = seen.get(m.pilot.role) || 0;
        seen.set(m.pilot.role, index + 1);
        this.spawn(m, index);
      }
    }
  }
  addHuman(id: string, name: string) {
    if (this.phase !== "LOBBY")
      throw new Error(
        "Pertandingan sudah dimulai. Join kembali saat lobby/rematch.",
      );
    const humans = [...this.players.values()].filter((m) => !m.bot);
    if (humans.length >= 14) throw new Error("Room penuh.");
    const teams = (["auric", "verdant"] as Team[]).sort(
      (a, b) =>
        humans.filter((m) => m.pilot.team === a).length -
        humans.filter((m) => m.pilot.team === b).length,
    );
    const team = teams[0],
      role = (Object.keys(CAPACITY) as Role[]).find((r) =>
        canSelect(
          humans.map((m) => m.pilot),
          id,
          team,
          r,
        ),
      )!;
    const p = makePilot(id, name, team);
    p.role = role;
    this.players.set(id, this.member(p, false));
    if (!this.hostId) this.hostId = id;
    this.fillBots();
  }
  removeHuman(id: string) {
    const m = this.players.get(id);
    if (!m) return;
    if (this.ball.owner === id) this.releaseBall(m);
    if (this.phase === "LOBBY") {
      this.players.delete(id);
      this.fillBots();
    } else {
      const p = {
        ...m.pilot,
        id: `replacement-${id}`,
        name: `${m.pilot.name} (AI)`,
        bot: true,
      };
      this.players.delete(id);
      const replacement = this.member(p, true);
      replacement.goals = m.goals;
      replacement.passes = m.passes;
      replacement.catches = m.catches;
      this.players.set(p.id, replacement);
    }
    if (this.hostId === id)
      this.hostId =
        [...this.players.values()].find((x) => !x.bot && x.connected)?.pilot
          .id || "";
  }
  setConnected(id: string, connected: boolean) {
    const m = this.players.get(id);
    if (m) {
      m.connected = connected;
      if (!connected)
        m.input = { ...neutralInput(), yaw: m.pilot.yaw, pitch: m.pilot.pitch };
    }
    if (!connected && this.hostId === id) {
      this.hostId =
        [...this.players.values()].find((x) => !x.bot && x.connected)?.pilot
          .id || id;
    }
  }
  select(id: string, team: Team, role: Role) {
    if (
      this.phase !== "LOBBY" ||
      !["auric", "verdant"].includes(team) ||
      !Object.hasOwn(CAPACITY, role)
    )
      return false;
    const m = this.players.get(id);
    if (!m || m.bot) return false;
    const humans = [...this.players.values()]
      .filter((x) => !x.bot)
      .map((x) => x.pilot);
    if (!canSelect(humans, id, team, role)) return false;
    m.pilot.team = team;
    m.pilot.role = role;
    m.ready = false;
    this.fillBots();
    return true;
  }
  setReady(id: string, ready: boolean) {
    const m = this.players.get(id);
    if (this.phase === "LOBBY" && m && !m.bot) m.ready = ready;
  }
  configure(id: string, duration: number) {
    if (
      this.phase !== "LOBBY" ||
      id !== this.hostId ||
      ![60, 300, 600].includes(duration)
    )
      return false;
    this.duration = duration;
    return true;
  }
  start(id: string) {
    if (this.phase !== "LOBBY" || id !== this.hostId) return false;
    if (
      [...this.players.values()].some(
        (m) => !m.bot && (!m.connected || !m.ready),
      )
    )
      return false;
    this.fillBots();
    this.phase = "COUNTDOWN";
    this.countdown = 3;
    this.elapsed = 0;
    this.scores = { auric: 0, verdant: 0 };
    this.winner = null;
    this.reason = "";
    this.ball = freshBall();
    this.resetTimer = 0;
    this.hazards = [
      {
        id: "hazard-0",
        x: -22,
        y: 17,
        z: 10,
        vx: 0,
        vy: 0,
        vz: 9,
        team: null,
        grace: 0,
        lastHit: null,
      },
      {
        id: "hazard-1",
        x: 22,
        y: 20,
        z: -10,
        vx: 0,
        vy: 0,
        vz: -9,
        team: null,
        grace: 0,
        lastHit: null,
      },
    ];
    Object.assign(this.target, { x: 20, y: 28, z: 0, vx: 0, vy: 0, vz: 0 });
    this.target.state = "hidden";
    this.target.captor = null;
    this.events.length = 0;
    for (const m of this.players.values()) {
      m.goals = 0;
      m.passes = 0;
      m.catches = 0;
    }
    return true;
  }
  rematch(id: string) {
    if (this.phase !== "ENDED" || id !== this.hostId) return false;
    this.phase = "LOBBY";
    for (const m of this.players.values()) m.ready = m.bot;
    this.fillBots();
    return true;
  }
  submitInput(id: string, input: unknown) {
    const m = this.players.get(id);
    if (!m || !validInput(input) || input.seq <= m.pilot.seq) return false;
    m.input = { ...input };
    m.lastInputAt = this.clock;
    return true;
  }
  private event(type: MatchEvent["type"], text: string, team?: Team) {
    this.events.push({
      id: ++this.eventId,
      type,
      text,
      team,
      time: this.elapsed,
    });
    if (this.events.length > 12) this.events.shift();
  }
  private end(reason: string) {
    if (this.phase !== "LIVE") return;
    this.phase = "ENDED";
    this.reason = reason;
    this.winner =
      this.scores.auric === this.scores.verdant
        ? "draw"
        : this.scores.auric > this.scores.verdant
          ? "auric"
          : "verdant";
    this.event("end", reason);
  }
  private releaseBall(m: MatchMember) {
    this.ball.owner = null;
    this.ball.mode = "free";
    this.ball.x = m.pilot.x;
    this.ball.y = m.pilot.y;
    this.ball.z = m.pilot.z;
    this.ball.vx = m.pilot.vx * 0.3;
    this.ball.vy = 0;
    this.ball.vz = m.pilot.vz * 0.3;
    this.ball.age = 0;
    this.ball.lastTouch = m.pilot.id;
    this.ball.lastTeam = m.pilot.team;
  }
  private pickup(m: MatchMember) {
    this.ball.owner = m.pilot.id;
    this.ball.mode = "carried";
    this.ball.lastTouch = m.pilot.id;
    this.ball.lastTeam = m.pilot.team;
    this.ball.age = 0;
  }
  action(id: string, value: unknown) {
    const m = this.players.get(id);
    if (
      !m ||
      this.phase !== "LIVE" ||
      !validAction(value) ||
      value.id <= m.lastActionId
    )
      return false;
    m.lastActionId = value.id;
    if (m.cooldown > 0 || m.pilot.recovery > 0.6) return false;
    const p = m.pilot;
    let type = value.type;
    if (type === "interact") {
      if (p.role === "Seeker") type = "catch";
      else if (p.role === "Warden") type = "block";
      else if (this.ball.owner === id) type = "pass";
      else if (this.ball.owner) {
        const owner = this.players.get(this.ball.owner);
        if (
          owner &&
          owner.pilot.team !== p.team &&
          ["Striker", "Keeper"].includes(p.role) &&
          distance(p, owner.pilot) < 2.8
        ) {
          this.pickup(m);
          m.cooldown = 0.65;
          this.event("steal", `${p.name} merebut bola`, p.team);
          return true;
        }
        return false;
      } else if (
        ["Striker", "Keeper"].includes(p.role) &&
        this.ball.mode !== "reset" &&
        distance(p, this.ball) < 3.5
      ) {
        this.pickup(m);
        m.cooldown = 0.2;
        return true;
      } else return false;
    }
    if (type === "catch") {
      if (
        p.role !== "Seeker" ||
        this.target.state !== "catchable" ||
        distance(p, this.target) > 3
      )
        return false;
      this.target.state = "captured";
      this.target.captor = id;
      m.catches++;
      this.scores[p.team] += RULESET.catchPoints;
      this.event("catch", `${p.name} menangkap Aurel Wing · +30`, p.team);
      this.end("Aurel Wing tertangkap");
      return true;
    }
    if (type === "block") {
      if (!["Warden", "Keeper"].includes(p.role)) return false;
      if (p.role === "Keeper" && p.z * attackSign(p.team) > -43) return false;
      m.blockUntil = this.elapsed + 1;
      m.cooldown = 1.1;
      return true;
    }
    if (type === "strike") {
      if (p.role !== "Warden") return false;
      const h = [...this.hazards].sort(
        (a, b) => distance(p, a) - distance(p, b),
      )[0];
      if (distance(p, h) > 6) return false;
      const direction = normalized(value.aim || viewDirection(p));
      h.vx = direction.x * 27;
      h.vy = direction.y * 27;
      h.vz = direction.z * 27;
      h.team = p.team;
      h.grace = 1.1;
      h.lastHit = id;
      m.cooldown = 0.9;
      return true;
    }
    if (
      (type === "shoot" || type === "pass") &&
      this.ball.owner === id &&
      ["Striker", "Keeper"].includes(p.role)
    ) {
      let aim = value.aim || viewDirection(p);
      let force = 34;
      if (type === "pass") {
        const teammates = this.teamMembers(p.team)
          .filter((x) => x !== m && x.pilot.role === "Striker")
          .sort((a, b) => distance(p, a.pilot) - distance(p, b.pilot));
        const friend = teammates.find((x) => distance(p, x.pilot) < 48);
        if (!friend) return false;
        const t = distance(p, friend.pilot) / 28;
        aim = {
          x: friend.pilot.x + friend.pilot.vx * t * 0.5 - p.x,
          y: friend.pilot.y + 0.7 - (p.y + 0.7) + 0.65 * t * t,
          z: friend.pilot.z + friend.pilot.vz * t * 0.5 - p.z,
        };
        force = 28;
        m.passes++;
      }
      const direction = normalized(aim);
      this.ball.owner = null;
      this.ball.mode = "thrown";
      this.ball.age = 0;
      this.ball.lastTouch = id;
      this.ball.lastTeam = p.team;
      this.ball.x = p.x + direction.x * 1.2;
      this.ball.y = p.y + 0.7;
      this.ball.z = p.z + direction.z * 1.2;
      this.ball.vx = direction.x * force + p.vx * 0.15;
      this.ball.vy = direction.y * force;
      this.ball.vz = direction.z * force + p.vz * 0.15;
      m.cooldown = 0.4;
      return true;
    }
    return false;
  }
  private stepBall(dt: number) {
    const b = this.ball;
    b.age += dt;
    if (b.mode === "reset") {
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) this.ball = freshBall();
      return;
    }
    if (b.owner) {
      const owner = this.players.get(b.owner);
      if (!owner) {
        b.owner = null;
        b.mode = "free";
        return;
      }
      b.x = owner.pilot.x + Math.sin(owner.pilot.yaw) * 0.8;
      b.y = owner.pilot.y + 0.7;
      b.z = owner.pilot.z + Math.cos(owner.pilot.yaw) * 0.8;
      return;
    }
    const previous = { x: b.x, y: b.y, z: b.z };
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.mode === "thrown") b.vy -= 1.3 * dt;
    else {
      b.vx *= Math.exp(-1.2 * dt);
      b.vz *= Math.exp(-1.2 * dt);
      b.vy += (10 - b.y) * 0.3 * dt;
      b.vy *= Math.exp(-1.1 * dt);
    }
    const candidates = [...this.players.values()]
      .filter(
        (m) =>
          ["Striker", "Keeper"].includes(m.pilot.role) &&
          m.pilot.recovery < 0.6 &&
          !(b.lastTouch === m.pilot.id && b.age < 0.5),
      )
      .sort((a, c) => distance(a.pilot, b) - distance(c.pilot, b));
    for (const m of candidates) {
      const radius =
        m.pilot.role === "Keeper"
          ? m.blockUntil > this.elapsed
            ? 4.5
            : 2.3
          : 1.7;
      if (
        segmentDistance(
          { x: m.pilot.x, y: m.pilot.y + 0.7, z: m.pilot.z },
          previous,
          b,
        ) < radius
      ) {
        this.pickup(m);
        if (m.pilot.role === "Keeper")
          this.event("block", `${m.pilot.name} menahan bola`, m.pilot.team);
        return;
      }
    }
    if (b.mode === "thrown") {
      const team = crossedGoal(previous, b);
      if (team) {
        this.scores[team] += RULESET.goalPoints;
        const scorer = b.lastTouch ? this.players.get(b.lastTouch) : undefined;
        if (scorer?.pilot.team === team) scorer.goals++;
        this.event(
          "goal",
          `GOL ${team === "auric" ? "AURIC" : "VERDANT"} · +10`,
          team,
        );
        b.mode = "reset";
        b.owner = null;
        this.resetTimer = 3;
        return;
      }
    }
    if (Math.abs(b.x) > 51 || Math.abs(b.z) > 96) {
      b.x = clamp(b.x, -50, 50);
      b.z = clamp(b.z, -95, 95);
      b.vx *= -0.35;
      b.vz *= -0.35;
      b.mode = "free";
    }
    if (b.y < 2) {
      b.y = 2;
      b.vy = Math.abs(b.vy) * 0.35;
      b.mode = "free";
    }
    if (b.age > 8 && b.mode === "thrown") b.mode = "free";
  }
  private stepTarget(dt: number) {
    const target = this.target;
    if (target.state === "captured" || !this.targetEnabled) return;
    const reveal = Math.min(100, this.duration * 0.25);
    if (this.elapsed < reveal) {
      target.state = "hidden";
      return;
    }
    const t = this.elapsed - reveal,
      previous = { x: target.x, y: target.y, z: target.z };
    const catchable = t > 9 && t % 22 > 9;
    const phase = t * 0.16;
    target.x = Math.cos(phase) * 23;
    target.z = Math.sin(phase * 0.8) * 39;
    target.y = 25 + Math.sin(phase * 1.2) * 5;
    target.vx = (target.x - previous.x) / dt;
    target.vy = (target.y - previous.y) / dt;
    target.vz = (target.z - previous.z) / dt;
    if (t < dt * 2) target.vx = target.vy = target.vz = 0;
    target.state = catchable
      ? "catchable"
      : [...this.players.values()].some(
            (m) => m.pilot.role === "Seeker" && distance(m.pilot, target) < 7,
          )
        ? "evading"
        : "cruising";
  }
  private stepHazards(dt: number) {
    for (const h of this.hazards) {
      h.grace = Math.max(0, h.grace - dt);
      const enemies = [...this.players.values()]
        .filter((m) => h.team === null || m.pilot.team !== h.team)
        .sort((a, b) => distance(a.pilot, h) - distance(b.pilot, h));
      const target = enemies[0]?.pilot;
      if (target && h.grace === 0) {
        const direction = normalized({
          x: target.x - h.x,
          y: target.y - h.y,
          z: target.z - h.z,
        });
        const f = 1 - Math.exp(-1.4 * dt);
        h.vx += (direction.x * 12 - h.vx) * f;
        h.vy += (direction.y * 12 - h.vy) * f;
        h.vz += (direction.z * 12 - h.vz) * f;
      }
      h.x += h.vx * dt;
      h.y = clamp(h.y + h.vy * dt, 5, 42);
      h.z += h.vz * dt;
      if (Math.abs(h.x) > 49 || Math.abs(h.z) > 94) {
        h.x = clamp(h.x, -49, 49);
        h.z = clamp(h.z, -94, 94);
        h.vx *= -0.7;
        h.vz *= -0.7;
        h.team = null;
      }
      if (h.grace > 0) continue;
      for (const m of this.players.values())
        if (distance(m.pilot, h) < 2) {
          const guard = [...this.players.values()].find(
            (g) =>
              g.pilot.team === m.pilot.team &&
              g.blockUntil > this.elapsed &&
              distance(g.pilot, m.pilot) < 6,
          );
          if (guard) {
            h.vx *= -1.5;
            h.vy = 4;
            h.vz *= -1.5;
            h.team = m.pilot.team;
            h.grace = 1;
            this.event(
              "block",
              `${guard.pilot.name} menangkis hazard`,
              m.pilot.team,
            );
          } else {
            m.pilot.vx *= 0.55;
            m.pilot.vz *= 0.55;
            m.pilot.energy = Math.max(0, m.pilot.energy - 9);
            m.pilot.recovery = 0.65;
            h.vx *= -0.8;
            h.vz *= -0.8;
            h.team = null;
            h.grace = 1.2;
            if (this.ball.owner === m.pilot.id) this.releaseBall(m);
          }
          h.lastHit = m.pilot.id;
          break;
        }
    }
  }
  private playerContacts() {
    const all = [...this.players.values()];
    for (let a = 0; a < all.length; a++)
      for (let b = a + 1; b < all.length; b++) {
        const p = all[a].pilot,
          q = all[b].pilot,
          range = distance(p, q);
        if (range > 0.01 && range < 1.2) {
          const f = ((1.2 - range) * 0.25) / range,
            dx = (p.x - q.x) * f,
            dy = (p.y - q.y) * f,
            dz = (p.z - q.z) * f;
          p.x += dx;
          p.y += dy;
          p.z += dz;
          q.x -= dx;
          q.y -= dy;
          q.z -= dz;
        }
      }
  }
  step(dt = 1 / 30) {
    if (this.phase === "LOBBY" || this.phase === "ENDED") return;
    this.clock += dt;
    this.tick++;
    if (this.phase === "COUNTDOWN") {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown <= 0) {
        this.phase = "LIVE";
        this.event("start", "Kick-off!");
      }
      return;
    }
    this.elapsed += dt;
    for (const m of this.players.values()) {
      m.cooldown = Math.max(0, m.cooldown - dt);
      if (m.bot && this.tick % 3 === 0) {
        const decision = decideBot(this, m);
        this.submitInput(m.pilot.id, decision.input);
        if (decision.action) this.action(m.pilot.id, decision.action);
        if (this.phase !== "LIVE") return;
      }
      const input =
        m.connected && this.clock - m.lastInputAt < 0.35
          ? m.input
          : { ...neutralInput(), yaw: m.pilot.yaw, pitch: 0 };
      stepFlight(m.pilot, input, dt, this.clock);
    }
    this.playerContacts();
    this.stepTarget(dt);
    this.stepBall(dt);
    this.stepHazards(dt);
    if (this.elapsed >= this.duration) this.end("Waktu pertandingan habis");
  }
  snapshot(): MatchSnapshot {
    return {
      phase: this.phase,
      hostId: this.hostId,
      duration: this.duration,
      remaining: Math.max(0, this.duration - this.elapsed),
      countdown: this.countdown,
      scores: { ...this.scores },
      winner: this.winner,
      reason: this.reason,
      roster: [...this.players.values()].map((m) => ({
        id: m.pilot.id,
        name: m.pilot.name,
        team: m.pilot.team,
        role: m.pilot.role,
        bot: m.bot,
        connected: m.connected,
        ready: m.ready,
        state: m.state,
        goals: m.goals,
        passes: m.passes,
        catches: m.catches,
      })),
      ball: { ...this.ball },
      hazards: this.hazards.map((h) => ({ ...h })),
      target: { ...this.target },
      events: this.events.map((e) => ({ ...e })),
    };
  }
}
