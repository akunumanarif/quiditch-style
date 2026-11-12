import { Room, type Client } from "@colyseus/core";
import { randomBytes } from "node:crypto";
import {
  safeName,
  validInvite,
  type Team,
  type Role,
} from "../../../../packages/shared/index.ts";
import { MatchSimulation } from "../game/match.ts";
export class MatchRoom extends Room {
  maxClients = 14;
  private invite = randomBytes(24).toString("hex");
  private game = new MatchSimulation();
  private accumulator = 0;
  private broadcasts = 0;
  private rates = new Map<string, { at: number; count: number }>();
  onCreate() {
    this.setPrivate(true);
    this.onMessage("input", (c, v: unknown) => {
      if (this.permit(c)) this.game.submitInput(c.sessionId, v);
    });
    this.onMessage("action", (c, v: unknown) => {
      if (this.permit(c)) this.game.action(c.sessionId, v);
    });
    this.onMessage("select", (c, v: unknown) => {
      if (!this.permit(c) || !v || typeof v !== "object") return;
      const d = v as { team: Team; role: Role };
      if (!this.game.select(c.sessionId, d.team, d.role))
        c.send(
          "notice",
          "Tim/role tidak tersedia atau pertandingan sudah dimulai.",
        );
    });
    this.onMessage("ready", (c, v: unknown) => {
      if (this.permit(c) && typeof v === "boolean")
        this.game.setReady(c.sessionId, v);
    });
    this.onMessage("configure", (c, v: unknown) => {
      if (
        this.permit(c) &&
        typeof v === "number" &&
        !this.game.configure(c.sessionId, v)
      )
        c.send("notice", "Hanya host yang dapat mengatur durasi di lobby.");
    });
    this.onMessage("start", (c) => {
      if (this.permit(c) && !this.game.start(c.sessionId))
        c.send(
          "notice",
          "Hanya host dapat mulai. Semua pemain manusia perlu Ready.",
        );
    });
    this.onMessage("rematch", (c) => {
      if (this.permit(c) && !this.game.rematch(c.sessionId))
        c.send(
          "notice",
          "Rematch hanya tersedia untuk host setelah pertandingan selesai.",
        );
    });
    this.onMessage("ping", (c) => {
      if (this.permit(c)) c.send("pong", Date.now());
    });
    this.setSimulationInterval((delta) => {
      this.accumulator += Math.min(delta / 1000, 0.25);
      while (this.accumulator >= 1 / 30) {
        this.game.step(1 / 30);
        this.accumulator -= 1 / 30;
      }
      if (++this.broadcasts % 3 === 0)
        this.broadcast("snapshot", {
          tick: this.game.tick,
          pilots: [...this.game.players.values()].map((m) => m.pilot),
          match: this.game.snapshot(),
        });
    }, 1000 / 30);
  }
  private permit(c: Client) {
    let r = this.rates.get(c.sessionId);
    if (!r || Date.now() - r.at > 1000) {
      r = { at: Date.now(), count: 0 };
      this.rates.set(c.sessionId, r);
    }
    return ++r.count <= 70;
  }
  onAuth(_client: Client, options: { invite?: string }) {
    if (this.game.players.size && !validInvite(this.invite, options.invite))
      throw new Error("Undangan salah atau room kedaluwarsa.");
    if (this.game.phase !== "LOBBY")
      throw new Error(
        "Pertandingan sedang berlangsung. Join kembali saat lobby.",
      );
    return true;
  }
  onJoin(c: Client, options: { name?: string }) {
    this.game.addHuman(c.sessionId, safeName(options.name));
    c.send("welcome", { invite: this.invite, roomId: this.roomId });
  }
  async onDrop(c: Client) {
    this.game.setConnected(c.sessionId, false);
    try {
      await this.allowReconnection(c, 30);
      this.game.setConnected(c.sessionId, true);
    } catch {
      /* onLeave handles expiry */
    }
  }
  onLeave(c: Client) {
    this.game.removeHuman(c.sessionId);
    this.rates.delete(c.sessionId);
  }
}
