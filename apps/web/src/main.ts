import "./style.css";
import {
  FLIGHT_PHYSICS,
  keyboardTurnRate,
} from "../../../packages/shared/aerodynamics.ts";
import { clamp, damp, dampAngle } from "../../../packages/shared/motion.ts";
import { Client, type Room } from "@colyseus/sdk";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { makeEngine, buildArena } from "./arena";
import { menuPreview } from "./preview";
import { loadSettings, saveSettings, type FlightAction } from "./storage";
import { FlightAudio } from "./audio";
import {
  COURSE_DURATION,
  COURSE_GATES,
  segmentDistance,
  safeCamera,
} from "../../../packages/shared/flight-course.ts";
import {
  makePilot,
  neutralInput,
  stepFlight,
  type Pilot,
} from "../../../packages/shared/index.ts";
const app = document.querySelector<HTMLDivElement>("#app")!;
const canvas = document.querySelector<HTMLCanvasElement>("#arena")!;
let preview: ReturnType<typeof menuPreview> | undefined;
let settings = loadSettings();
saveSettings(settings);
let mode: "menu" | "flight" = "menu";
let paused = false;
let pendingRebind: ((event: KeyboardEvent) => void) | undefined;
let world: ReturnType<typeof buildArena> | undefined;
let runtime: Awaited<ReturnType<typeof makeEngine>> | undefined;
let room: Room | undefined;
let me = makePilot("local");
let pilots: Pilot[] = [];
let invite = "";
let currentRoom = "";
let seq = 0;
let yaw = 0;
let pitch = 0;
let cameraHeading = 0;
let cameraPitch = 0;
const cameraLook = new Vector3(0, 14, 0);
let snapshotReceivedAt = 0;
let queuedQuickTurn = false;
let observedTurnCount = 0;
const cameraBoom = new Vector3();
let frame = 0;
let netClock = 0;
let pingStart = 0;
let rtt = 0;
let elapsed = 0;
let ready = false;
let checkCancelled = false;
const samples: number[] = [];
const profileTransitions: {
  quality: string;
  frames: number;
  p95: number;
  elapsed: number;
}[] = [];
let lastAppliedQuality = "Medium";
function applyQuality(preset: string) {
  if (!world) return;
  if (preset !== lastAppliedQuality && samples.length) {
    const sorted = [...samples].sort((a, b) => a - b);
    profileTransitions.push({
      quality: lastAppliedQuality,
      frames: samples.length,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      elapsed,
    });
    samples.length = 0;
  }
  world.quality(preset);
  lastAppliedQuality = preset;
}
let stage = "";
let targetIndex = 0;
let laps = 0;
const gates = COURSE_GATES.map((p) => new Vector3(p.x, p.y, p.z));
const audio = new FlightAudio();
let captureView: "flight" | "stadium" | "rider" = "flight";
let courseFinished = false;
let simulationAccumulator = 0;
const keys = new Set<string>();
let effectiveQuality = "Medium";
let showDebug = false;
let menuTime = 0;
let autoSlow = 0;
const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
function keyLabel(code: string) {
  return code
    .replace(/^Key/, "")
    .replace("Space", "SPACE")
    .replace("ControlLeft", "CTRL")
    .replace("ControlRight", "CTRL R")
    .replace("ShiftLeft", "SHIFT")
    .replace("ShiftRight", "SHIFT R");
}
function resetFlightView() {
  cameraHeading = me.yaw;
  cameraPitch = me.pitch;
  cameraLook.set(
    me.x + Math.sin(cameraHeading) * 12,
    me.y + 1 + cameraPitch * 8,
    me.z + Math.cos(cameraHeading) * 12,
  );
  const safe = safeCamera(
    { x: me.x, y: me.y + 1, z: me.z },
    {
      x: me.x - Math.sin(cameraHeading) * 9,
      y: me.y + 3.2 - cameraPitch * 2,
      z: me.z - Math.cos(cameraHeading) * 9,
    },
  );
  cameraBoom.set(safe.x, safe.y, safe.z);
  world?.camera.position.copyFrom(cameraBoom);
  world?.camera.setTarget(cameraLook);
}
function toast(message: string) {
  let t = document.querySelector("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.append(t);
  }
  t.textContent = message;
  setTimeout(() => t?.remove(), 4500);
}
const emblem =
  '<svg viewBox="0 0 60 60" fill="none" aria-hidden="true"><path d="M30 3 53 14v20L30 56 7 34V14Z" stroke="currentColor" stroke-width="1.7"/><path d="m15 20 15 9 15-9-15 23-15-23Zm15 9V12" stroke="currentColor" stroke-width="2"/><path d="M12 17h36" stroke="currentColor"/></svg>';
function shell() {
  app.innerHTML = `<div class="vignette"></div><header><a class="brand" href="/">${emblem}<span>BROOM<span class="brand-small">LEAGUE</span></span></a><nav><span class="nav-active">PLAY</span><button id="how">FLIGHT GUIDE</button><button id="settings">SETTINGS</button></nav><span class="build">M1 <i></i> FLIGHT EDITION</span></header><main class="landing"><div class="eyebrow"><span></span> THE SKY IS YOUR PLAYING FIELD</div><h1>Born to fly.<br>Built to <em>compete.</em></h1><p class="intro">A broom. An open sky. A league of your own.<br>Take flight above the stone walls of Windmere.</p><div class="menu-card"><div class="card-caption">YOUR NEXT FLIGHT <span>01 / WINDMERE</span></div><label class="name-label">PILOT NAME<input id="name" maxlength="20" autocomplete="nickname" aria-label="Nama pilot"></label><button class="primary" id="practice"><span class="button-symbol">↗</span><span>Quick practice<small>Find your wings · solo flight course</small></span><b>→</b></button><div class="secondary-row"><button id="create">＋ Create room</button><button id="join">↗ Join room</button></div><div class="card-bottom"><i></i> No account needed <span>KEYBOARD + MOUSE</span></div></div><div class="preview-note">ONE-MINUTE FLIGHT TRIAL <span>Detailed rider · scanned materials · shared skies</span></div></main><aside class="location"><span class="location-line"></span><div>THE WINDMERE GROUNDS<small>Highlands arena · Golden hour</small></div><span class="weather">☀ <b>18°</b><small>WIND 8 KM/H</small></span></aside><footer><span><i></i> ${runtime?.renderer || "BABYLON.JS"} <span class="muted"> / </span> DESKTOP EDITION</span><span>ORIGINAL WORLD. LIMITLESS SKIES.</span><span>v0.2.0 <span class="muted">·</span> M1 DEVELOPMENT BUILD</span></footer>`;
  ($("#name") as HTMLInputElement).value = settings.name;
  $("#name").onchange = () => {
    settings.name = ($("#name") as HTMLInputElement).value;
    saveSettings(settings);
  };
  $("#practice").onclick = () => void begin("practice");
  $("#create").onclick = () => void begin("create");
  $("#join").onclick = () => joinDialog();
  $("#settings").onclick = () => settingsDialog();
  $("#how").onclick = () => guide();
}
function modal(content: string) {
  document.querySelector(".modal-backdrop")?.remove();
  const d = document.createElement("div");
  d.className = "modal-backdrop";
  d.innerHTML = `<section class="modal">${content}</section>`;
  app.append(d);
  return d;
}
function closeModal() {
  if (pendingRebind) {
    window.removeEventListener("keydown", pendingRebind, true);
    pendingRebind = undefined;
  }
  document.querySelector(".modal-backdrop")?.remove();
}
function guide() {
  modal(
    `<div class="eyebrow">FLIGHT SCHOOL / 01</div><h2>Find your wings.</h2><p>Terbang melewati enam waypoint berurutan. Klik arena untuk mengarahkan pandangan dengan mouse. Tahan W bersama A/D untuk terbang serong mengikuti kemiringan.</p><div class="control-grid"><kbd>W / S</kbd><span>Dorong / rem udara</span><kbd>A / D</kbd><span>Condong · W + A/D untuk serong</span><kbd>Q</kbd><span>Putar balik 180° · 24 energi</span><kbd>${keyLabel(settings.bindings.ascend)} / ${keyLabel(settings.bindings.descend)}</kbd><span>Naik / turun</span><kbd>SHIFT</kbd><span>Boost · memakai energi</span><kbd>← ↑ ↓ →</kbd><span>Arah alternatif tanpa mouse</span><kbd>R</kbd><span>Pusatkan arah</span><kbd>ESC</kbd><span>Pengaturan / lepas mouse</span><kbd>F3</kbd><span>Profiling</span></div><button class="primary" id="close">Ready to fly →</button>`,
  );
  $("#close").onclick = closeModal;
}
function settingsDialog() {
  paused = true;
  document.exitPointerLock?.();
  modal(
    `<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>Flight settings</h2><label>Graphics<select id="quality">${["Auto", "Low", "Medium", "High"].map((q) => `<option ${q === settings.quality ? "selected" : ""}>${q}</option>`).join("")}</select></label><label>Mouse sensitivity<input id="sensitivity" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"></label><label class="check"><input id="motion" type="checkbox" ${settings.reducedMotion ? "checked" : ""}> Reduced motion · gentle camera</label><label class="check"><input id="audio" type="checkbox" ${settings.audio ? "checked" : ""}> Wind & flight sounds</label><details class="bindings"><summary>Keyboard controls · click to rebind</summary><div class="binding-grid">${Object.entries(
      settings.bindings,
    )
      .map(
        ([action, key]) =>
          `<label>${action === "left" ? "lean left" : action === "right" ? "lean right" : action}<button class="outline key-bind" data-action="${action}">${key.replace("Key", "")}</button></label>`,
      )
      .join(
        "",
      )}</div></details><p class="muted">Perubahan grafik langsung berlaku. RAM bebas sistem tidak dapat diketahui oleh browser.</p><button class="primary" id="save">Save & return →</button>${mode === "flight" ? '<button class="text-button" id="leave">Return to main menu</button>' : ""}<button class="text-button" id="clear">Reset local preferences</button>`,
  );
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    ".key-bind",
  ))
    button.onclick = () => {
      if (pendingRebind)
        window.removeEventListener("keydown", pendingRebind, true);
      button.textContent = "Press a key…";
      const handler = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.removeEventListener("keydown", handler, true);
        pendingRebind = undefined;
        if (
          event.code !== "Escape" &&
          /^(Key[A-Z]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right))$/.test(
            event.code,
          )
        ) {
          const action = button.dataset.action as FlightAction;
          if (
            Object.entries(settings.bindings).some(
              ([other, key]) => other !== action && key === event.code,
            )
          ) {
            toast("Tombol sudah dipakai aksi lain.");
          } else settings.bindings[action] = event.code;
        }
        button.textContent = settings.bindings[
          button.dataset.action as FlightAction
        ].replace("Key", "");
      };
      pendingRebind = handler;
      window.addEventListener("keydown", handler, true);
    };
  $("#save").onclick = () => {
    settings.quality = ($("#quality") as HTMLSelectElement)
      .value as typeof settings.quality;
    settings.sensitivity = Number(
      ($("#sensitivity") as HTMLInputElement).value,
    );
    settings.reducedMotion = ($("#motion") as HTMLInputElement).checked;
    settings.audio = ($("#audio") as HTMLInputElement).checked;
    audio.setEnabled(settings.audio);
    world?.setReducedMotion(settings.reducedMotion);
    saveSettings(settings);
    applyQuality(
      settings.quality === "Auto" ? effectiveQuality : settings.quality,
    );
    paused = false;
    closeModal();
  };
  $("#clear").onclick = () => {
    try {
      localStorage.removeItem("broomleague:settings:v1");
    } catch {
      /* optional */
    }
    settings = loadSettings();
    settingsDialog();
  };
  if (mode === "flight") $("#leave").onclick = () => void leave();
}
function joinDialog() {
  modal(
    '<div class="eyebrow">BETTER TOGETHER</div><h2>Join a private flight</h2><p>Tempel invite URL dari host. Server harus dapat dijangkau kedua browser.</p><input id="invite-url" placeholder="http://localhost:5173/?room=…#invite=…" aria-label="Invite URL"><button class="primary" id="join-go">Join room →</button><button class="text-button" id="cancel">Cancel</button>',
  );
  $("#cancel").onclick = closeModal;
  $("#join-go").onclick = () => {
    try {
      const u = new URL(($("#invite-url") as HTMLInputElement).value);
      const id = u.searchParams.get("room"),
        token = new URLSearchParams(u.hash.slice(1)).get("invite");
      if (!id || !token) throw new Error();
      void begin("join", id, token);
    } catch {
      toast("Invite URL tidak valid.");
    }
  };
}
async function readiness() {
  checkCancelled = false;
  const d = modal(
    '<div class="eyebrow">DEVICE READINESS</div><h2>Checking your device…</h2><p id="check-text">Memeriksa renderer dan mengukur scene ringan.</p><div class="progress"><span></span></div><button class="text-button" id="skip">Skip test</button>',
  );
  $("#skip").onclick = () => {
    checkCancelled = true;
  };
  const canvasProbe = document.createElement("canvas");
  canvasProbe.width = 320;
  canvasProbe.height = 180;
  const gl = canvasProbe.getContext("webgl2");
  const gpu = await WebGPUEngine.IsSupportedAsync;
  if (!gl && !gpu)
    throw new Error("WebGL2 / WebGPU tidak tersedia di browser ini.");
  let p95 = 0;
  let count = 0;
  if (gl) {
    const e = new Engine(gl, false);
    const s = new Scene(e);
    new FreeCamera("probe", new Vector3(0, 0, -12), s);
    new HemisphericLight("probe light", Vector3.Up(), s);
    for (let i = 0; i < 12; i++) {
      const b = MeshBuilder.CreateBox("probe", { size: 0.8 }, s);
      b.position.set((i % 4) - 1.5, Math.floor(i / 4) - 1, 0);
    }
    const times: number[] = [];
    let last = performance.now();
    await new Promise<void>((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        e.stopRenderLoop(run);
        resolve();
      };
      const run = () => {
        const now = performance.now();
        times.push(now - last);
        last = now;
        s.meshes.forEach((m) => (m.rotation.y += 0.02));
        s.render();
        count++;
        if (count >= 45 || checkCancelled) finish();
      };
      const timeout = window.setTimeout(() => {
        checkCancelled = true;
        finish();
      }, 6000);
      e.runRenderLoop(run);
    });
    times.splice(0, 8);
    times.sort((a, b) => a - b);
    p95 = times[Math.floor(times.length * 0.95)] || 0;
    s.dispose();
    e.dispose();
  }
  const deviceMemoryBucket = (
    navigator as Navigator & { deviceMemory?: number }
  ).deviceMemory;
  const constrained =
    p95 > 32 || (deviceMemoryBucket !== undefined && deviceMemoryBucket <= 2);
  const result = {
    version: 1,
    renderer: gl ? "WebGL2 available" : "WebGPU available",
    maxTextureSize: gl
      ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number)
      : null,
    hardwareConcurrencyHint: navigator.hardwareConcurrency || null,
    deviceMemoryBucketGB: deviceMemoryBucket ?? null,
    p95Ms: Math.round(p95 * 100) / 100,
    frames: count,
    skipped: checkCancelled,
    time: new Date().toISOString(),
  };
  try {
    localStorage.setItem("broomleague:deviceCheck:v1", JSON.stringify(result));
  } catch {
    /* optional */
  }
  effectiveQuality = constrained ? "Low" : "Medium";
  if (settings.quality === "Auto") applyQuality(effectiveQuality);
  d.querySelector(".modal")!.innerHTML =
    `<div class="eyebrow">DEVICE READINESS</div><h2>${checkCancelled ? "Renderer available" : constrained ? "Playable with reduced graphics" : "Ready for take-off"}</h2><p>${result.renderer} · ${checkCancelled ? "Benchmark dilewati" : `Microbenchmark p95: ${result.p95Ms} ms (${count} frames)`}.</p><p class="muted">RAM bebas sistem tidak dapat ditentukan browser ini. Hasil ini adalah estimasi scene ringan, bukan jaminan performa arena.</p>${constrained ? "<p>Coba tutup tab atau aplikasi berat lain. Kamu tetap bisa lanjut bermain.</p>" : ""}<button class="primary" id="continue">${constrained ? "Continue anyway" : "Continue to flight"} →</button><button class="text-button" id="back">Back</button>`;
  return new Promise<boolean>((resolve) => {
    $("#continue").onclick = () => {
      audio.unlock();
      audio.setEnabled(settings.audio);
      closeModal();
      resolve(true);
    };
    $("#back").onclick = () => {
      closeModal();
      resolve(false);
    };
  });
}
async function ensureWorld() {
  if (world) return;
  stage = "Loading arena";
  toast("Building Windmere arena…");
  await boot;
  if (!runtime) throw new Error("Renderer belum siap.");
  preview?.dispose();
  preview = undefined;
  world = buildArena(runtime.engine, canvas);
  world.setReducedMotion(settings.reducedMotion);
  applyQuality(
    settings.quality === "Auto" ? effectiveQuality : settings.quality,
  );
  runtime.engine.runRenderLoop(update);
  await Promise.all([world.physicsReady, world.assetReady, world.sceneryReady]);
  window.addEventListener("resize", () => runtime?.engine.resize());
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    toast(
      "Konteks grafis terputus. Muat ulang halaman untuk memulihkan arena.",
    );
  });
  ready = true;
  stage = "Ready";
}
async function connect(kind: "create" | "join", id?: string, token?: string) {
  const origin =
    import.meta.env.VITE_SERVER_URL ||
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
  const client = new Client(origin);
  room =
    kind === "create"
      ? await client.create("flight", { name: settings.name })
      : await client.joinById(id!, { invite: token, name: settings.name });
  room.reconnection.minUptime = 0;
  me = makePilot(room.sessionId, settings.name);
  currentRoom = room.roomId;
  room.onMessage("welcome", (d: { invite: string }) => {
    invite = d.invite;
  });
  room.onMessage("snapshot", (d: { pilots: Pilot[] }) => {
    snapshotReceivedAt = performance.now();
    pilots = d.pilots;
    const mine = pilots.find((p) => p.id === room?.sessionId);
    if (mine) {
      me = { ...mine };
    }
  });
  room.onMessage("notice", (s: string) => toast(s));
  room.onMessage("pong", () => {
    rtt = Math.round(performance.now() - pingStart);
  });
  room.onDrop(() => toast("Koneksi terputus. Mencoba menyambung kembali…"));
  room.onReconnect(() => {
    toast("Terhubung kembali.");
    try {
      sessionStorage.setItem(
        "broomleague:reconnect:v1",
        room!.reconnectionToken,
      );
    } catch {
      /* optional */
    }
  });
  room.onLeave(() => {
    if (mode === "flight") {
      toast("Room ditutup. Buat room baru untuk melanjutkan.");
      void leave();
    }
  });
  room.onError((_code, msg) => toast(msg || "Network error"));
  try {
    sessionStorage.setItem("broomleague:reconnect:v1", room.reconnectionToken);
  } catch {
    /* optional */
  }
}
async function begin(
  kind: "practice" | "create" | "join",
  id?: string,
  token?: string,
) {
  try {
    if (!(await readiness())) return;
    modal(
      '<div class="eyebrow">PREPARING YOUR FLIGHT</div><h2>Almost in the air…</h2><p>Memuat arena dan menghubungkan sesi.</p>',
    );
    await ensureWorld();
    if (kind !== "practice") await connect(kind, id, token);
    else {
      me = makePilot("local", settings.name);
      pilots = [me];
    }
    audio.unlock();
    audio.setEnabled(settings.audio);
    courseFinished = false;
    simulationAccumulator = 0;
    observedTurnCount = me.turnCount;
    queuedQuickTurn = false;
    yaw = me.yaw;
    pitch = 0;
    resetFlightView();
    elapsed = 0;
    targetIndex = 0;
    laps = 0;
    mode = "flight";
    paused = false;
    closeModal();
    hud();
    toast("Klik arena untuk mouse look. W untuk terbang.");
  } catch (e) {
    closeModal();
    toast(e instanceof Error ? e.message : "Tidak dapat memulai. Coba lagi.");
  }
}
function hud() {
  app.innerHTML = `<div class="flight-top"><div class="hud-brand">${emblem}<div>WINDMERE<small>${room ? "PRIVATE FLIGHT / M1" : "PRACTICE / 60 SECOND TRIAL"}</small></div></div><div class="course-heading"><span id="trial-clock">FLIGHT TRAINING / 01:00</span><b id="objective">WAYPOINT 01 / 06</b></div><button class="outline" id="pause">ESC · SETTINGS</button></div><div class="wind-pressure" id="wind-pressure"></div><div class="air-feedback"><span id="air-readout">AIR 0 KM/H · 0 Pa · 1.0G</span><b id="turn-readout">Q · QUICK TURN READY</b></div><div class="reticle">＋</div><div id="waypoint" class="waypoint"><span>◇</span><small id="distance">100 m</small></div><div class="objective-panel"><span class="eyebrow">${room ? "SHARED SKIES" : "YOUR OBJECTIVE"}</span><h3>${room ? "Fly together." : "Follow the gold."}</h3><p>${room ? "Gerakan pilot disimulasikan server." : "Lewati waypoint emas. Selesaikan rute sebanyak mungkin dalam 60 detik."}</p><small id="course-stats">0 / 6 WAYPOINTS</small>${room ? '<button class="outline" id="copy">Copy invite link ↗</button><select id="team"><option value="auric">Auric</option><option value="verdant">Verdant</option></select><select id="role"><option>Striker</option><option>Warden</option><option>Keeper</option><option>Seeker</option></select><small id="members"></small>' : ""}</div><div class="flight-bottom"><div class="speed"><b id="speed">00</b><span>KM/H<small id="altitude">ALT 13 M</small></span></div><div class="energy-wrap"><div><span>BOOST ENERGY</span><b id="energy-text">100%</b></div><div class="energy"><span id="energy-fill"></span></div><small>HOLD <kbd>SHIFT</kbd> TO BOOST · <kbd>S</kbd> AIRBRAKE</small></div><div class="flight-hints"><span><kbd>${keyLabel(settings.bindings.forward)}</kbd> THRUST · <kbd>${keyLabel(settings.bindings.left)} ${keyLabel(settings.bindings.right)}</kbd> LEAN</span><span><kbd>${keyLabel(settings.bindings.ascend)}</kbd> ASCEND</span><span><kbd>${keyLabel(settings.bindings.descend)}</kbd> DESCEND</span></div></div><div id="debug" hidden></div>`;
  $("#pause").onclick = settingsDialog;
  if (room) {
    $("#copy").onclick = async () => {
      const u = new URL(location.origin + location.pathname);
      u.searchParams.set("room", currentRoom);
      u.hash = new URLSearchParams({ invite }).toString();
      try {
        await navigator.clipboard.writeText(u.href);
        toast("Invite link disalin.");
      } catch {
        modal(
          '<h2>Invite link</h2><input id="copy-manual" readonly><button class="primary" id="done">Done</button>',
        );
        ($("#copy-manual") as HTMLInputElement).value = u.href;
        $("#done").onclick = closeModal;
      }
    };
    const select = () =>
      room?.send("select", {
        team: ($("#team") as HTMLSelectElement).value,
        role: ($("#role") as HTMLSelectElement).value,
      });
    $("#team").onchange = select;
    $("#role").onchange = select;
  }
}
async function leave() {
  mode = "menu";
  paused = false;
  document.exitPointerLock?.();
  keys.clear();
  audio.update(0, false);
  if (room) {
    await room.leave();
    room = undefined;
  }
  pilots = [];
  world?.updatePilots([], 0);
  try {
    sessionStorage.removeItem("broomleague:reconnect:v1");
  } catch {
    /* optional */
  }
  shell();
}
function update() {
  if (!world || !runtime) return;
  const rawDt = Math.min(runtime.engine.getDeltaTime() / 1000, 0.25);
  const dt = Math.min(rawDt, 0.05);
  samples.push(runtime.engine.getDeltaTime());
  if (samples.length > 600) samples.shift();
  frame++;
  menuTime += dt;
  if (mode === "menu") {
    if (!settings.reducedMotion) {
      const angle = 0.78 + Math.sin(menuTime * 0.025) * 0.12;
      world.camera.position.set(
        Math.cos(angle) * 140,
        66,
        Math.sin(angle) * -157,
      );
      world.camera.setTarget(new Vector3(0, 6, 12));
    }
  } else {
    const active = !paused && !courseFinished;
    const i = neutralInput();
    i.seq = ++seq;
    if (active) {
      const arrows = +keys.has("ArrowRight") - +keys.has("ArrowLeft");
      yaw += arrows * keyboardTurnRate(me.airSpeed) * rawDt;
      i.quickTurn = queuedQuickTurn;
      pitch = Math.max(
        -0.85,
        Math.min(
          0.85,
          pitch +
            ((keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0)) *
              rawDt,
        ),
      );
      i.forward =
        +keys.has(settings.bindings.forward) -
        +keys.has(settings.bindings.back);
      i.strafe =
        +keys.has(settings.bindings.right) - +keys.has(settings.bindings.left);
      i.lift =
        +keys.has(settings.bindings.ascend) -
        +keys.has(settings.bindings.descend);
      i.boost = keys.has(settings.bindings.boost);
    }
    yaw =
      ((((yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) -
      Math.PI;
    i.yaw = yaw;
    i.pitch = pitch;
    if (active) elapsed += rawDt;
    const previousPosition = new Vector3(me.x, me.y, me.z);
    if (room) {
      netClock += rawDt;
      if (netClock >= 1 / 30) {
        room.send("input", i);
        netClock %= 1 / 30;
        queuedQuickTurn = false;
      }
      if (frame % 120 === 0) {
        pingStart = performance.now();
        room.send("ping");
      }
    } else {
      simulationAccumulator += rawDt;
      while (simulationAccumulator >= 1 / 60) {
        stepFlight(me, i, 1 / 60);
        simulationAccumulator -= 1 / 60;
        queuedQuickTurn = false;
      }
      pilots = [me];
    }
    if (me.turnCount > observedTurnCount) {
      observedTurnCount = me.turnCount;
      yaw = me.turnTargetYaw;
      audio.quickTurn();
    }
    world.updatePilots(
      pilots,
      rawDt,
      room ? (performance.now() - snapshotReceivedAt) / 1000 : 0,
    );
    const pose = world.getPilotPose(me.id);
    const anchor = {
      x: pose?.x ?? me.x,
      y: (pose?.y ?? me.y) + 1,
      z: pose?.z ?? me.z,
    };
    cameraHeading = dampAngle(
      cameraHeading,
      pose?.yaw ?? me.yaw,
      settings.reducedMotion ? 16 : 11,
      rawDt,
    );
    cameraPitch = damp(cameraPitch, me.pitch, 10, rawDt);
    const desired = new Vector3(
      anchor.x - Math.sin(cameraHeading) * 9,
      anchor.y + 2.2 - cameraPitch * 2,
      anchor.z - Math.cos(cameraHeading) * 9,
    );
    const safe = safeCamera(anchor, desired);
    desired.set(safe.x, safe.y, safe.z);
    const windFeedback = world.updateAirflow(
      me,
      rawDt,
      active,
      settings.reducedMotion,
    );
    const crosswind = me.windX * Math.cos(me.yaw) - me.windZ * Math.sin(me.yaw);
    audio.update(
      me.airSpeed,
      active,
      me.pressure,
      crosswind,
      me.loadFactor + me.rollLoad * 0.4,
    );
    cameraBoom.copyFrom(
      Vector3.Lerp(
        cameraBoom,
        desired,
        1 - Math.exp(-(settings.reducedMotion ? 16 : 10) * rawDt),
      ),
    );
    world.camera.position.set(
      cameraBoom.x + windFeedback.x,
      cameraBoom.y + windFeedback.y,
      cameraBoom.z,
    );
    // Look direction eases as well as camera position; neither snaps on mouse/key changes.
    const look = new Vector3(
      anchor.x + Math.sin(cameraHeading) * 12,
      anchor.y + cameraPitch * 8,
      anchor.z + Math.cos(cameraHeading) * 12,
    );
    cameraLook.copyFrom(
      Vector3.Lerp(cameraLook, look, 1 - Math.exp(-14 * rawDt)),
    );
    world.camera.setTarget(cameraLook);
    world.camera.rotation.z = settings.reducedMotion
      ? 0
      : (pose?.bank.value ?? 0) * 0.055 + windFeedback.roll;
    if (captureView === "stadium") {
      world.camera.position.set(116, 68, -135);
      world.camera.setTarget(new Vector3(0, 9, 9));
      world.camera.fov = 0.85;
    }
    if (captureView === "rider") {
      world.camera.position.set(me.x + 3.4, me.y + 1.5, me.z - 3.6);
      world.camera.setTarget(new Vector3(me.x, me.y + 0.4, me.z));
    }
    world.camera.fov = damp(
      world.camera.fov,
      settings.reducedMotion
        ? 0.83
        : 0.83 + clamp(me.airSpeed / 45, 0, 1) * 0.09,
      7,
      rawDt,
    );
    const target = gates[targetIndex];
    const dist = Vector3.Distance(new Vector3(me.x, me.y, me.z), target);
    if (
      segmentDistance(target, previousPosition, me) < 5 &&
      !room &&
      !courseFinished
    ) {
      targetIndex++;
      audio.cue();
      if (targetIndex === gates.length) {
        targetIndex = 0;
        laps++;
        toast(`Route complete! ${laps} lap · ${Math.round(elapsed)} seconds`);
      } else toast("Waypoint reached. Next marker unlocked.");
    }
    if (!room && elapsed >= COURSE_DURATION && !courseFinished) {
      courseFinished = true;
      paused = true;
      keys.clear();
      audio.update(0, false);
      audio.cue();
      document.exitPointerLock?.();
      modal(
        `<div class="eyebrow">WINDMERE FLIGHT TRIAL</div><h2>Clear skies. Good flying.</h2><p>Sesi latihan 60 detik selesai.</p><div class="trial-result"><b>${laps * 6 + targetIndex}</b><span>WAYPOINTS REACHED</span></div><p>${laps} complete laps · ${Math.round(me.energy)}% energy remaining</p><button class="primary" id="again">Fly again →</button><button class="text-button" id="trial-menu">Return to main menu</button>`,
      );
      $("#again").onclick = () => {
        me = makePilot("local", settings.name);
        pilots = [me];
        elapsed = 0;
        targetIndex = 0;
        laps = 0;
        yaw = 0;
        pitch = 0;
        courseFinished = false;
        paused = false;
        simulationAccumulator = 0;
        queuedQuickTurn = false;
        observedTurnCount = 0;
        resetFlightView();
        closeModal();
      };
      $("#trial-menu").onclick = () => void leave();
    }
    const projected = Vector3.Project(
      gates[targetIndex],
      Matrix.Identity(),
      world.scene.getTransformMatrix(),
      world.camera.viewport.toGlobal(
        runtime.engine.getRenderWidth(),
        runtime.engine.getRenderHeight(),
      ),
    );
    const sx = (projected.x / runtime.engine.getRenderWidth()) * innerWidth,
      sy = (projected.y / runtime.engine.getRenderHeight()) * innerHeight;
    const marker = $("#waypoint");
    marker.style.left = `${Math.max(40, Math.min(innerWidth - 40, sx))}px`;
    marker.style.top = `${Math.max(120, Math.min(innerHeight - 140, sy))}px`;
    if (frame % 6 === 0) {
      $("#air-readout").textContent =
        `AIR ${Math.round(me.airSpeed * 3.6)} KM/H · ${Math.round(me.pressure)} Pa · ${me.loadFactor.toFixed(1)}G · BANK ${Math.round((Math.abs(me.bank) * 180) / Math.PI)}°`;
      const turnKey = settings.bindings.quickTurn.replace("Key", "");
      $("#turn-readout").textContent =
        me.turnRemaining > 0
          ? "AIRBRAKE TURN · 180°"
          : `${turnKey} · ${me.turnCooldown > 0 ? `READY IN ${me.turnCooldown.toFixed(1)}s` : me.energy < FLIGHT_PHYSICS.turnEnergy ? "NEED 24 ENERGY" : "QUICK TURN READY"}`;
      $("#wind-pressure").style.opacity = settings.reducedMotion
        ? "0"
        : String(Math.min(0.75, me.pressure / 1400));
      const remaining = Math.max(0, Math.ceil(COURSE_DURATION - elapsed));
      $("#trial-clock").textContent = room
        ? "PRIVATE FLIGHT"
        : `TRIAL / ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
      $("#waypoint").style.opacity =
        projected.z < 0 || projected.z > 1 ? ".25" : "1";
      $("#speed").textContent = String(
        Math.round(Math.hypot(me.vx, me.vy, me.vz) * 3.6),
      ).padStart(2, "0");
      $("#altitude").textContent = `ALT ${Math.round(me.y)} M`;
      $("#energy-text").textContent = `${Math.round(me.energy)}%`;
      $("#energy-fill").style.width = `${me.energy}%`;
      $("#distance").textContent = `${Math.round(dist)} m`;
      $("#objective").textContent =
        `WAYPOINT ${String(targetIndex + 1).padStart(2, "0")} / 06`;
      $("#course-stats").textContent =
        `${targetIndex} / 6 WAYPOINTS · ${laps} LAPS · ${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;
      if (room) {
        $("#members").textContent = `${pilots.length} / 14 PILOTS · ${rtt} MS`;
      }
    }
    const debug = $("#debug");
    debug.hidden = !showDebug;
    if (showDebug && frame % 15 === 0) {
      const sorted = [...samples].sort((a, b) => a - b);
      debug.textContent = `${runtime.renderer} | ${world.physics} | ${Math.round(runtime.engine.getFps())} FPS | p95 ${(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1)} ms | ${world.scene.meshes.length} meshes | ${world.scene.getActiveMeshes().length} active | ${world.scene.getEngine()._drawCalls.current} draws | RTT ${rtt} ms | ${stage}`;
    }
    if (settings.quality === "Auto" && rawDt > 0.032 && elapsed > 5)
      autoSlow += rawDt;
    else autoSlow = Math.max(0, autoSlow - dt);
    if (autoSlow > 3 && effectiveQuality !== "Low") {
      effectiveQuality = "Low";
      applyQuality("Low");
      toast("Auto graphics: kualitas diturunkan untuk menjaga performa.");
      autoSlow = 0;
    }
  }
  world.scene.render();
}
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).matches("input,select")) return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "F3"].includes(
      e.code,
    )
  )
    e.preventDefault();
  keys.add(e.code);
  if (e.code === "F3") showDebug = !showDebug;
  if (
    e.code === settings.bindings.quickTurn &&
    !e.repeat &&
    mode === "flight" &&
    !paused
  ) {
    if (me.turnCooldown > 0)
      toast(`Putar balik siap dalam ${me.turnCooldown.toFixed(1)} detik.`);
    else if (me.energy < FLIGHT_PHYSICS.turnEnergy)
      toast("Putar balik membutuhkan 24 energi.");
    else queuedQuickTurn = true;
  }
  if (e.code === settings.bindings.recenter) {
    yaw = me.yaw;
    pitch = 0;
  }
  if (e.code === "Escape" && mode === "flight" && !paused) settingsDialog();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
canvas.onclick = () => {
  audio.unlock();
  if (mode === "flight" && !paused) void canvas.requestPointerLock();
};
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === canvas && !paused) {
    yaw += e.movementX * 0.002 * settings.sensitivity;
    pitch = Math.max(
      -0.85,
      Math.min(0.85, pitch - e.movementY * 0.002 * settings.sensitivity),
    );
    yaw =
      ((((yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) -
      Math.PI;
  }
});
shell();
// A local in-engine still keeps the menu lightweight before readiness.
const boot = makeEngine(canvas)
  .then((r) => {
    runtime = r;
    preview = menuPreview(r.engine);
    r.engine.runRenderLoop(preview.render);
    window.addEventListener("resize", () => r.engine.resize());
    shell();
    const u = new URL(location.href),
      id = u.searchParams.get("room"),
      token = new URLSearchParams(u.hash.slice(1)).get("invite");
    if (id && token) void begin("join", id, token);
  })
  .catch((e) => {
    toast(e.message);
    stage = "Renderer unavailable";
  });
Object.assign(window, {
  broomDebug: {
    setView(view: "flight" | "stadium" | "rider") {
      captureView = view;
    },
    get metrics() {
      const sorted = [...samples].sort((a, b) => a - b);
      return {
        renderer: runtime?.renderer,
        fps: runtime?.engine.getFps(),
        p95: sorted[Math.floor(sorted.length * 0.95)],
        profileTransitions,
        sampleFrames: samples.length,
        meshes: world?.scene.meshes.length,
        physics: world?.physics,
        glbLoadMs: world?.glbLoadMs,
        glbStatus: world?.glbStatus,
        visuals: world?.visualMetrics,
        motion: world?.getPilotPose(me.id),
        camera: world
          ? {
              x: world.camera.position.x,
              y: world.camera.position.y,
              z: world.camera.position.z,
              yaw: cameraHeading,
              pitch: cameraPitch,
            }
          : undefined,
        sphereY: world?.sphereY,
        pilots,
        ready,
        courseFinished,
        elapsed,
      };
    },
  },
});
