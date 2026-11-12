import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { Client, type Room } from "@colyseus/sdk";
import type { MatchSnapshot } from "../packages/shared/match.ts";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(f: () => boolean, ms = 7000) {
  const at = Date.now();
  while (!f()) {
    if (Date.now() - at > ms) throw new Error("Match network timeout");
    await delay(40);
  }
}
test(
  "match room replaces bots on join, validates host/ready/invites, shares authority and replaces voluntary departure",
  { timeout: 25000 },
  async () => {
    const server = spawn(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "apps/server/src/index.ts"],
      {
        env: { ...process.env, PORT: "2579" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let started = false;
    server.stdout.on("data", (d) => {
      if (String(d).includes("server_ready")) started = true;
    });
    const rooms: Room[] = [];
    try {
      await until(() => started);
      const health = await fetch("http://localhost:2579/health");
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), {
        ok: true,
        service: "broom-league",
        protocol: 1,
      });
      const client = new Client("ws://localhost:2579");
      const h = await client.create("match", { name: "Host" });
      rooms.push(h);
      let invite = "",
        a: MatchSnapshot | undefined,
        b: MatchSnapshot | undefined;
      h.onMessage("welcome", (d: { invite: string }) => (invite = d.invite));
      h.onMessage("snapshot", (d: { match: MatchSnapshot }) => (a = d.match));
      const hostNotices: string[] = [],
        guestNotices: string[] = [];
      h.onMessage("notice", (message: string) => hostNotices.push(message));
      await until(() => !!a && !!invite);
      assert.equal(a!.roster.length, 14);
      assert.equal(a!.roster.filter((m) => m.bot).length, 13);
      await assert.rejects(client.joinById(h.roomId, { invite: "bad" }));
      const guest = await client.joinById(h.roomId, { invite, name: "Guest" });
      rooms.push(guest);
      guest.onMessage("welcome", () => {});
      guest.onMessage(
        "snapshot",
        (d: { match: MatchSnapshot }) => (b = d.match),
      );
      guest.onMessage("notice", (message: string) =>
        guestNotices.push(message),
      );
      await until(() => a!.roster.filter((m) => !m.bot).length === 2 && !!b);
      guest.send("configure", 60);
      guest.send("start");
      await delay(150);
      assert.equal(a!.duration, 600);
      assert.equal(a!.phase, "LOBBY");
      assert.ok(
        guestNotices.some(
          (message) =>
            message === "Hanya host yang dapat memulai pertandingan.",
        ),
      );
      h.send("configure", 60);
      h.send("start");
      await delay(150);
      assert.equal(a!.phase, "LOBBY");
      assert.ok(
        hostNotices.some((message) =>
          message.includes("Kamu adalah host. Klik Ready"),
        ),
      );
      assert.equal(a!.hostId, h.sessionId);
      h.send("ready", true);
      await until(() => a!.roster.find((m) => m.id === h.sessionId)!.ready);
      h.send("start");
      await until(() =>
        hostNotices.some((message) =>
          message.includes("Menunggu Ready dari: Guest"),
        ),
      );
      assert.equal(a!.phase, "LOBBY");
      guest.send("ready", true);
      await until(() => a!.roster.filter((m) => !m.bot).every((m) => m.ready));
      h.send("start");
      await until(() => a!.phase === "LIVE" && b!.phase === "LIVE");
      assert.equal(a!.roster.length, 14);
      await assert.rejects(client.joinById(h.roomId, { invite }));
      guest.send("action", { id: 1, type: "goal", points: 999 });
      await delay(150);
      assert.ok(a!.scores.verdant < 999);
      assert.deepEqual(a!.scores, b!.scores);
      const guestId = guest.sessionId;
      await guest.leave();
      await until(() =>
        a!.roster.some((m) => m.id === `replacement-${guestId}`),
      );
      assert.equal(a!.roster.filter((m) => m.bot).length, 13);
      assert.equal(a!.roster.length, 14);
    } finally {
      for (const r of rooms) await r.leave().catch(() => {});
      server.kill("SIGTERM");
    }
  },
);
