import { test } from "node:test";
import assert from "node:assert/strict";
import { MatchSimulation } from "../apps/server/src/game/match.ts";
import { crossedGoal, validAction } from "../packages/shared/match.ts";
import { CAPACITY } from "../packages/shared/index.ts";
function start(duration = 60, targetEnabled = false) {
  const g = new MatchSimulation({ duration, targetEnabled });
  g.addHuman("host", "Host");
  g.setReady("host", true);
  assert.ok(g.start("host"));
  while (g.phase === "COUNTDOWN") g.step();
  return g;
}
test("lobby bots fill exact 7v7 role capacities and yield to humans", () => {
  const g = new MatchSimulation();
  g.addHuman("a", "A");
  g.addHuman("b", "B");
  assert.equal(g.players.size, 14);
  assert.equal([...g.players.values()].filter((m) => m.bot).length, 12);
  for (const team of ["auric", "verdant"] as const) {
    assert.equal(g.teamMembers(team).length, 7);
    for (const [role, count] of Object.entries(CAPACITY))
      assert.equal(
        g.teamMembers(team).filter((m) => m.pilot.role === role).length,
        count,
      );
  }
  assert.ok(g.select("a", "verdant", "Keeper"));
  assert.equal(g.select("b", "verdant", "Keeper"), false);
  assert.equal(g.start("b"), false);
  assert.equal(g.start("a"), false);
  g.setReady("a", true);
  g.setReady("b", true);
  assert.ok(g.start("a"));
  assert.equal(g.select("a", "auric", "Seeker"), false);
  assert.throws(() => g.addHuman("late", "Late"));
});
test("goal detection sweeps ring interior in the valid direction", () => {
  assert.equal(
    crossedGoal({ x: 0, y: 22, z: 77 }, { x: 0, y: 22, z: 82 }),
    "auric",
  );
  assert.equal(
    crossedGoal({ x: -12, y: 17, z: -77 }, { x: -12, y: 17, z: -82 }),
    "verdant",
  );
  assert.equal(
    crossedGoal({ x: 0, y: 22, z: 82 }, { x: 0, y: 22, z: 77 }),
    null,
  );
  assert.equal(
    crossedGoal({ x: 6, y: 22, z: 77 }, { x: 6, y: 22, z: 82 }),
    null,
  );
});
test("authoritative goals score once, reset ball, and reject remote scoring claims", () => {
  const g = start();
  g.players.clear();
  Object.assign(g.ball, { x: 0, y: 22, z: 78, vz: 60, mode: "thrown", age: 1 });
  g.step();
  assert.equal(g.scores.auric, 10);
  assert.equal(g.ball.mode, "reset");
  for (let i = 0; i < 80; i++) g.step();
  assert.equal(g.scores.auric, 10);
  for (let i = 0; i < 20; i++) g.step();
  assert.equal(g.ball.mode, "free");
  assert.equal(validAction({ id: 1, type: "goal", points: 999 }), false);
  assert.equal(
    validAction({ id: 1, type: "shoot", aim: { x: NaN, y: 0, z: 1 } }),
    false,
  );
});
test("role, distance, cooldown and replay protection guard ball and catch actions", () => {
  const g = start();
  const h = g.players.get("host")!;
  assert.equal(g.action("host", { id: 1, type: "catch" }), false);
  Object.assign(h.pilot, { x: g.ball.x, y: g.ball.y, z: g.ball.z });
  assert.ok(g.action("host", { id: 2, type: "interact" }));
  assert.equal(g.ball.owner, "host");
  assert.equal(g.action("host", { id: 2, type: "shoot" }), false);
  assert.equal(g.action("host", { id: 3, type: "shoot" }), false);
  h.cooldown = 0;
  assert.ok(
    g.action("host", { id: 4, type: "shoot", aim: { x: 0, y: 0, z: 1 } }),
  );
  assert.equal(g.ball.mode, "thrown");
  h.pilot.role = "Warden";
  h.cooldown = 0;
  assert.equal(g.action("host", { id: 5, type: "interact" }), true);
  h.cooldown = 0;
  assert.equal(
    g.action("host", { id: 6, type: "strike", aim: { x: 0, y: 0, z: 1 } }),
    false,
  );
  h.pilot.role = "Seeker";
  g.target.state = "catchable";
  Object.assign(g.target, { x: 40, y: 30, z: 40 });
  assert.equal(g.action("host", { id: 7, type: "catch" }), false);
  Object.assign(h.pilot, { x: 40, y: 30, z: 40 });
  assert.ok(g.action("host", { id: 8, type: "catch" }));
  assert.equal(g.phase, "ENDED");
  assert.equal(g.scores.auric, 30);
  const scores = { ...g.scores };
  g.step();
  assert.deepEqual(g.scores, scores);
  assert.equal(g.action("host", { id: 9, type: "catch" }), false);
});
test("timer ends with highest score or draw, then host rematch clears readiness and stats", () => {
  const g = start();
  g.players.clear();
  g.scores.verdant = 20;
  for (let i = 0; i < 1802; i++) g.step();
  assert.equal(g.phase, "ENDED");
  assert.equal(g.winner, "verdant");
  assert.equal(g.rematch("other"), false);
  assert.ok(g.rematch("host"));
  g.addHuman("host", "Host");
  assert.equal(g.players.get("host")!.ready, false);
  g.setReady("host", true);
  assert.ok(g.start("host"));
  assert.deepEqual(g.scores, { auric: 0, verdant: 0 });
  const draw = start(1);
  draw.players.clear();
  for (let i = 0; i < 32; i++) draw.step();
  assert.equal(draw.winner, "draw");
});
test("departing human is replaced by a bot with same role and live position", () => {
  const g = start();
  const p = { ...g.players.get("host")!.pilot };
  g.removeHuman("host");
  assert.equal(g.players.size, 14);
  const replacement = g.players.get("replacement-host")!;
  assert.ok(replacement.bot);
  assert.equal(replacement.pilot.role, p.role);
  assert.equal(replacement.pilot.x, p.x);
});
test("unmodified bot controls play through actual goals and a golden catch to results", () => {
  const g = new MatchSimulation({ duration: 600 });
  g.fillBots();
  g.hostId = "fixture";
  assert.ok(g.start("fixture"));
  const seen = new Map();
  for (let i = 0; i < 18100 && g.phase !== "ENDED"; i++) {
    g.step();
    for (const e of g.events) seen.set(e.id, e);
    for (const m of g.players.values())
      assert.ok(
        [m.pilot.x, m.pilot.y, m.pilot.z, m.pilot.vx].every(Number.isFinite),
      );
  }
  assert.equal(g.phase, "ENDED");
  assert.ok(
    [...seen.values()].some((e) => e.type === "goal" && e.team === "auric"),
  );
  assert.ok(
    [...seen.values()].some((e) => e.type === "goal" && e.team === "verdant"),
  );
  assert.ok([...seen.values()].some((e) => e.type === "block"));
  assert.equal(g.target.state, "captured");
  assert.equal(
    [...g.players.values()].reduce((n, m) => n + m.catches, 0),
    1,
  );
  assert.ok(g.winner);
});
