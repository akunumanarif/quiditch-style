import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { Client, type Room } from "@colyseus/sdk";
import { neutralInput, type Pilot } from "../packages/shared/index.ts";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(f: () => boolean, ms = 6000) {
  const start = Date.now();
  while (!f()) {
    if (Date.now() - start > ms) throw new Error("Timed out");
    await delay(40);
  }
}
test(
  "server validates invites and roles, syncs input, reconnects one seat, and disposes empty rooms",
  { timeout: 30000 },
  async () => {
    const server = spawn(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "apps/server/src/index.ts"],
      {
        env: { ...process.env, PORT: "2578" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let started = false;
    server.stdout.on("data", (d) => {
      if (d.toString().includes("server_ready")) started = true;
    });
    const rooms: Room[] = [];
    try {
      await until(() => started);
      const client = new Client("ws://localhost:2578");
      const host = await client.create("flight", { name: "Host" });
      rooms.push(host);
      let invite = "";
      let pilots: Pilot[] = [];
      host.onMessage("welcome", (d: { invite: string }) => (invite = d.invite));
      host.onMessage(
        "snapshot",
        (d: { pilots: Pilot[] }) => (pilots = d.pilots),
      );
      host.onMessage("notice", () => {});
      await until(() => !!invite && pilots.length === 1);
      await assert.rejects(client.joinById(host.roomId, { invite: "invalid" }));
      const guest = await new Client("ws://localhost:2578").joinById(
        host.roomId,
        { invite, name: "Guest" },
      );
      rooms.push(guest);
      guest.onMessage("welcome", () => {});
      let guestPilots: Pilot[] = [];
      guest.onMessage("snapshot", (d: { pilots: Pilot[] }) => {
        guestPilots = d.pilots;
      });
      guest.onMessage("notice", () => {});
      await until(() => pilots.length === 2);
      host.send("select", { team: "auric", role: "Keeper" });
      await until(
        () => pilots.find((p) => p.id === host.sessionId)?.role === "Keeper",
      );
      guest.send("select", { team: "auric", role: "Keeper" });
      await delay(100);
      assert.notEqual(
        pilots.find((p) => p.id === guest.sessionId)?.role,
        "Keeper",
      );
      const z = pilots.find((p) => p.id === host.sessionId)!.z;
      for (let seq = 1; seq <= 12; seq++) {
        host.send("input", { ...neutralInput(), forward: 1, seq });
        await delay(34);
      }
      await until(() => pilots.find((p) => p.id === host.sessionId)!.z > z + 1);
      const y = pilots.find((p) => p.id === host.sessionId)!.y;
      host.send("input", { ...neutralInput(), lift: 999, seq: 999 });
      await delay(150);
      assert.ok(
        Math.abs(pilots.find((p) => p.id === host.sessionId)!.y - y) < 0.2,
      );
      const count = pilots.find((p) => p.id === host.sessionId)!.turnCount;
      host.send("input", {
        ...neutralInput(),
        quickTurn: true,
        yaw: Math.PI,
        seq: 1000,
      });
      await until(
        () =>
          pilots.find((p) => p.id === host.sessionId)!.turnCount === count + 1,
      );
      await until(
        () =>
          guestPilots.find((p) => p.id === host.sessionId)?.turnCount ===
          count + 1,
      );
      host.send("input", {
        ...neutralInput(),
        quickTurn: false,
        yaw: Math.PI,
        seq: 1001,
      });
      await delay(50);
      host.send("input", {
        ...neutralInput(),
        quickTurn: true,
        yaw: Math.PI,
        seq: 1002,
      });
      await delay(150);
      assert.equal(
        pilots.find((p) => p.id === host.sessionId)!.turnCount,
        count + 1,
        "server enforces quick-turn cooldown",
      );
      guest.reconnection.minUptime = 0;
      let reconnected = false;
      guest.onReconnect(() => {
        reconnected = true;
      });
      guest.connection.close(4010, "test interruption");
      await until(() => reconnected, 12000);
      assert.equal(pilots.length, 2);
      assert.equal(new Set(pilots.map((p) => p.id)).size, 2);
      await guest.leave();
      await host.leave();
      await delay(300);
      await assert.rejects(client.joinById(host.roomId, { invite }));
    } finally {
      for (const r of rooms) await r.leave().catch(() => {});
      server.kill("SIGTERM");
    }
  },
);
