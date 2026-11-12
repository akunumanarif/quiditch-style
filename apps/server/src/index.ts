import { MatchRoom } from "./rooms/MatchRoom.ts";
import { Server, Room, type Client } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { randomBytes } from "node:crypto";
import {
  makePilot,
  neutralInput,
  stepFlight,
  validInput,
  validInvite,
  safeName,
  canSelect,
  CAPACITY,
  type Pilot,
  type FlightInput,
  type Team,
  type Role,
} from "../../../packages/shared/index.ts";
class FlightRoom extends Room {
  maxClients = 14;
  private invite = randomBytes(24).toString("hex");
  private pilots = new Map<string, Pilot>();
  private flightInputs = new Map<string, FlightInput>();
  private rates = new Map<string, { time: number; count: number }>();
  private lastInput = new Map<string, number>();
  private tick = 0;
  onCreate() {
    this.setPrivate(true);
    this.onMessage("input", (client, data: unknown) => {
      if (!this.permit(client) || !validInput(data)) return;
      const p = this.pilots.get(client.sessionId);
      if (p && data.seq > p.seq) {
        this.flightInputs.set(client.sessionId, data);
        this.lastInput.set(client.sessionId, Date.now());
      }
    });
    this.onMessage("select", (client, data: unknown) => {
      if (!this.permit(client) || !data || typeof data !== "object") return;
      const d = data as { team: Team; role: Role };
      const p = this.pilots.get(client.sessionId);
      if (
        p &&
        ["auric", "verdant"].includes(d.team) &&
        Object.hasOwn(CAPACITY, d.role) &&
        canSelect([...this.pilots.values()], p.id, d.team, d.role)
      ) {
        p.team = d.team;
        p.role = d.role;
      } else client.send("notice", "Posisi ini sudah terisi.");
    });
    this.onMessage("ping", (client) => {
      if (this.permit(client)) client.send("pong", Date.now());
    });
    this.setSimulationInterval(() => {
      for (const [id, p] of this.pilots) {
        const i =
          Date.now() - (this.lastInput.get(id) || 0) < 300
            ? this.flightInputs.get(id) || neutralInput()
            : { ...neutralInput(), yaw: p.yaw };
        stepFlight(p, i, 1 / 30, this.tick / 30);
      }
      this.tick++;
      if (this.tick % 2 === 0)
        this.broadcast("snapshot", {
          tick: this.tick,
          pilots: [...this.pilots.values()],
        });
    }, 1000 / 30);
  }
  private permit(c: Client) {
    const now = Date.now();
    let r = this.rates.get(c.sessionId);
    if (!r || now - r.time > 1000) {
      r = { time: now, count: 0 };
      this.rates.set(c.sessionId, r);
    }
    return ++r.count <= 65;
  }
  onAuth(_client: Client, options: { invite?: string }) {
    if (this.pilots.size > 0 && !validInvite(this.invite, options.invite))
      throw new Error("Undangan salah atau kedaluwarsa.");
    return true;
  }
  onJoin(client: Client, options: { name?: string }) {
    const p = makePilot(client.sessionId, safeName(options.name));
    const all = [...this.pilots.values()];
    let assigned = false;
    for (const team of ["auric", "verdant"] as Team[])
      for (const role of Object.keys(CAPACITY) as Role[])
        if (!assigned && canSelect(all, p.id, team, role)) {
          p.team = team;
          p.role = role;
          assigned = true;
        }
    p.x = ((this.pilots.size % 5) - 2) * 4;
    this.pilots.set(client.sessionId, p);
    client.send("welcome", { invite: this.invite, roomId: this.roomId });
  }
  async onDrop(client: Client) {
    this.flightInputs.delete(client.sessionId);
    try {
      await this.allowReconnection(client, 30);
    } catch {
      /* Framework calls onLeave after the reserved seat expires. */
    }
  }
  onLeave(client: Client) {
    this.flightInputs.delete(client.sessionId);
    this.pilots.delete(client.sessionId);
    this.rates.delete(client.sessionId);
    this.lastInput.delete(client.sessionId);
  }
}
const server = new Server({ transport: new WebSocketTransport() });
server.define("flight", FlightRoom);
server.define("match", MatchRoom);
await server.listen(Number(process.env.PORT || 2567));
console.log(
  JSON.stringify({
    event: "server_ready",
    port: Number(process.env.PORT || 2567),
    milestone: "M2",
  }),
);
