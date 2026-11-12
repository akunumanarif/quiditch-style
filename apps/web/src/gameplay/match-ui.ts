import type {
  MatchSnapshot,
  MatchAction,
} from "../../../../packages/shared/match.ts";
import type { Pilot } from "../../../../packages/shared/index.ts";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function createMatchUI(
  send: (type: string, value?: unknown) => void,
  leave: () => void,
  view: () => {
    id: string;
    pilot: Pilot;
    yaw: number;
    pitch: number;
    interactKey: string;
  },
) {
  let state: MatchSnapshot | undefined,
    panel: HTMLDivElement | undefined,
    phase = "",
    rosterKey = "",
    actionId = 0;
  function action(primary = false) {
    if (state?.phase !== "LIVE") return;
    const v = view();
    const role = v.pilot.role;
    const type: MatchAction["type"] = primary
      ? role === "Warden"
        ? "strike"
        : role === "Seeker"
          ? "catch"
          : "shoot"
      : "interact";
    send("action", {
      id: ++actionId,
      type,
      aim: {
        x: Math.sin(v.yaw) * Math.cos(v.pitch),
        y: Math.sin(v.pitch),
        z: Math.cos(v.yaw) * Math.cos(v.pitch),
      },
    });
  }
  function update(s: MatchSnapshot) {
    state = s;
    if (!document.querySelector(".flight-top")) return;
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "match-layer";
      document.querySelector("#app")!.append(panel);
    }
    const self = s.roster.find((m) => m.id === view().id),
      host = s.hostId === view().id;
    const key = JSON.stringify([
      s.phase,
      s.hostId,
      s.duration,
      s.roster.map((m) => [m.id, m.team, m.role, m.ready, m.connected]),
    ]);
    if (phase !== s.phase) {
      phase = s.phase;
      document.exitPointerLock?.();
    }
    if (s.phase === "LOBBY") {
      if (key === rosterKey) return;
      rosterKey = key;
      const humans = s.roster.filter((m) => !m.bot);
      const waiting = humans.filter((m) => !m.ready || !m.connected);
      const canStart = host && humans.length > 0 && waiting.length === 0;
      const startStatus = !self?.ready
        ? `${host ? "Kamu adalah host. " : ""}Klik Ready setelah memilih tim dan role.${host ? " Setelah itu klik Mulai pertandingan." : ""}`
        : waiting.some((m) => !m.connected)
          ? "Menunggu pemain yang sedang menyambung kembali."
          : waiting.length
            ? `Menunggu Ready dari: ${waiting.map((m) => m.name).join(", ")}.`
            : host
              ? "Semua pemain siap. Klik Mulai pertandingan."
              : "Semua pemain siap. Menunggu host memulai pertandingan.";
      panel.innerHTML = `<section class="match-lobby"><div class="eyebrow">PRIVATE MATCH / 7 V 7</div><h2>Choose your place in the sky.</h2><p>Slot kosong diisi bot. Undang teman sebelum kick-off; bot akan menyerahkan slotnya.</p><div class="team-rosters">${(
        ["auric", "verdant"] as const
      )
        .map(
          (team) =>
            `<div class="roster ${team}"><h3>${team.toUpperCase()}</h3>${s.roster
              .filter((m) => m.team === team)
              .map(
                (m) =>
                  `<div class="roster-row ${m.id === self?.id ? "is-me" : ""}"><span>${escape(m.name)} <small>${m.id === s.hostId ? "HOST · " : ""}${m.bot ? "BOT" : m.connected ? (m.ready ? "READY" : "BELUM READY") : "RECONNECTING"}</small></span><b>${m.role}</b></div>`,
              )
              .join("")}</div>`,
        )
        .join(
          "",
        )}</div><div class="lobby-controls"><label>Tim<select id="match-team"><option value="auric">Auric</option><option value="verdant">Verdant</option></select></label><label>Role<select id="match-role">${["Striker", "Warden", "Keeper", "Seeker"].map((r) => `<option>${r}</option>`).join("")}</select></label><label>Durasi<select id="match-duration" ${host ? "" : "disabled"}><option value="60">1 menit</option><option value="300">5 menit</option><option value="600">10 menit</option></select></label><button class="outline" id="match-invite">Copy invite ↗</button></div><p class="match-rules">Gol +10 · Aurel Wing +30 dan pertandingan berakhir · Skor tertinggi menang</p><p id="lobby-start-status" role="status" aria-live="polite">${escape(startStatus)}</p><div class="lobby-buttons"><button class="primary" id="match-ready" aria-pressed="${!!self?.ready}">${self?.ready ? "Batalkan ready" : "Ready"}</button>${host ? `<button class="primary" id="match-start" ${canStart ? "" : "disabled"} aria-describedby="lobby-start-status">Mulai pertandingan →</button>` : "<span>Menunggu host memulai…</span>"}<button class="text-button" id="match-leave">Keluar</button></div></section>`;
      const select = (id: string) =>
        panel!.querySelector<HTMLSelectElement>(id)!;
      select("#match-team").value = self?.team || "auric";
      select("#match-role").value = self?.role || "Striker";
      select("#match-duration").value = String(s.duration);
      const change = () =>
        send("select", {
          team: select("#match-team").value,
          role: select("#match-role").value,
        });
      select("#match-team").onchange = change;
      select("#match-role").onchange = change;
      select("#match-duration").onchange = () =>
        send("configure", Number(select("#match-duration").value));
      panel.querySelector<HTMLButtonElement>("#match-ready")!.onclick = () =>
        send("ready", !self?.ready);
      panel
        .querySelector<HTMLButtonElement>("#match-start")
        ?.addEventListener("click", () => send("start"));
      panel.querySelector<HTMLButtonElement>("#match-invite")!.onclick = () =>
        document.querySelector<HTMLButtonElement>("#copy")?.click();
      panel.querySelector<HTMLButtonElement>("#match-leave")!.onclick = leave;
    } else if (s.phase === "ENDED") {
      if (key === rosterKey) return;
      rosterKey = key;
      panel.innerHTML = `<section class="match-lobby match-result"><div class="eyebrow">FULL TIME / WINDMERE</div><h2>${s.winner === "draw" ? "Hasil seri" : `${s.winner?.toUpperCase()} menang`}</h2><div class="result-score">${s.scores.auric} <span>—</span> ${s.scores.verdant}</div><p>${escape(s.reason)}</p><div class="team-rosters">${(
        ["auric", "verdant"] as const
      )
        .map(
          (team) =>
            `<div class="roster ${team}"><h3>${team.toUpperCase()} <small>GOL / OPER / TANGKAP</small></h3>${s.roster
              .filter((m) => m.team === team)
              .map(
                (m) =>
                  `<div class="roster-row"><span>${escape(m.name)} ${m.bot ? "<small>BOT</small>" : ""}</span><b>${m.goals} / ${m.passes} / ${m.catches}</b></div>`,
              )
              .join("")}</div>`,
        )
        .join(
          "",
        )}</div><div class="lobby-buttons">${host ? '<button class="primary" id="match-rematch">Rematch →</button>' : "<p>Menunggu host untuk rematch.</p>"}<button class="outline" id="match-leave">Kembali ke menu</button></div></section>`;
      panel
        .querySelector("#match-rematch")
        ?.addEventListener("click", () => send("rematch"));
      panel.querySelector("#match-leave")!.addEventListener("click", leave);
    } else {
      rosterKey = "";
      const owner = s.roster.find((m) => m.id === s.ball.owner);
      const remaining = Math.ceil(s.remaining);
      const v = view();
      const actionKey = v.interactKey;
      const tracked =
        self?.role === "Seeker"
          ? s.target
          : self?.role === "Warden"
            ? [...s.hazards].sort(
                (a, b) =>
                  Math.hypot(a.x - v.pilot.x, a.z - v.pilot.z) -
                  Math.hypot(b.x - v.pilot.x, b.z - v.pilot.z),
              )[0]
            : s.ball;
      const dx = tracked.x - v.pilot.x,
        dy = tracked.y - v.pilot.y,
        dz = tracked.z - v.pilot.z;
      const bearing = Math.atan2(
        Math.sin(Math.atan2(dx, dz) - v.yaw),
        Math.cos(Math.atan2(dx, dz) - v.yaw),
      );
      const range = Math.hypot(dx, dy, dz);
      const tracker =
        self?.role === "Seeker" && s.target.state === "hidden"
          ? ""
          : `${self?.role === "Seeker" ? "✦ TARGET" : self?.role === "Warden" ? "◆ HAZARD" : "● BOLA"} · ${Math.round(range)} m · ${Math.abs(bearing) < 0.2 ? "di depan" : bearing > 0 ? "kanan" : "kiri"} ${Math.round((Math.abs(bearing) * 180) / Math.PI)}° · ${dy > 0 ? "↑" : "↓"}${Math.round(Math.abs(dy))} m`;

      panel.innerHTML = `<div class="match-score"><b class="auric">AURIC ${s.scores.auric}</b><span>${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}</span><b class="verdant">${s.scores.verdant} VERDANT</b></div>${s.phase === "COUNTDOWN" ? `<div class="match-countdown"><small>KICK-OFF</small>${Math.ceil(s.countdown) || "GO"}</div>` : ""}<div class="match-status"><b>${self?.team.toUpperCase()} · ${self?.role}</b><span>${owner ? `Bola: ${escape(owner.name)}` : s.ball.mode === "reset" ? "Gol! Bola kembali ke tengah…" : "Bola bebas · kejar penanda merah"}</span><span>${s.target.state === "hidden" ? "Aurel Wing belum muncul" : s.target.state === "catchable" ? "AUREL WING · BISA DITANGKAP" : "Aurel Wing sedang terbang"}</span><span class="tracking-hint">${tracker}</span><small>${self?.role === "Warden" ? `${actionKey} tangkis · Klik kiri pukul hazard` : self?.role === "Seeker" ? `${actionKey} / Klik kiri tangkap target dalam jarak 3 m` : `${actionKey} ambil / rebut / oper · Klik kiri tembak`}<br>W thrust · A/D bank & turn · SPACE naik · E turun · Q putar balik</small></div><div class="match-feed">${s.events
        .slice(-3)
        .reverse()
        .map((e) => `<div>${escape(e.text)}</div>`)
        .join("")}</div>`;
    }
  }
  return {
    update,
    action,
    clear() {
      panel?.remove();
      panel = undefined;
      state = undefined;
      phase = "";
      rosterKey = "";
    },
  };
}
