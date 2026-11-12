import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const baseURL = process.env.BASE_URL || "http://localhost:5173";
const browser = await chromium.launch({ headless: true });
const errors = [];
const contexts = [];
async function page() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(c);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
async function enter(p, button) {
  await p.getByRole("button", { name: button }).click();
  await p.getByRole("button", { name: /Continue/ }).waitFor({ timeout: 30000 });
  await p.getByRole("button", { name: /Continue/ }).click();
  await p.waitForFunction(() => window.broomDebug?.metrics.ready, {
    timeout: 45000,
  });
  await p.locator(".flight-top").waitFor();
}
try {
  const p = await page();
  await p.addInitScript(() =>
    localStorage.setItem("broomleague:settings:v1", "{broken"),
  );
  await p.goto(baseURL);
  await p.waitForFunction(() =>
    document.querySelector("footer")?.textContent?.match(/WebGL|WebGPU/),
  );
  await mkdir("docs/screenshots", { recursive: true });
  await p.screenshot({ path: "docs/screenshots/menu.png" });
  await enter(p, "Quick practice");
  await p.keyboard.down("KeyW");
  await p.waitForTimeout(2200);
  await p.keyboard.up("KeyW");
  let metrics = await p.evaluate(() => window.broomDebug.metrics);
  assert.ok(metrics.pilots[0].z > -24, "flight advances");
  assert.equal(metrics.physics, "Havok V2");
  assert.ok(metrics.visuals.skyLoaded);
  assert.equal(metrics.visuals.riggedPilots, 1);
  assert.equal(metrics.visuals.animationClips.length, 8);
  assert.ok(metrics.visuals.activeMeshes > 10);
  assert.equal(metrics.glbStatus, "Loaded rigged rider PBR GLB");
  await p.waitForTimeout(16000);
  await p.screenshot({ path: "docs/screenshots/practice.png" });
  metrics = await p.evaluate(() => window.broomDebug.metrics);
  const preflight = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("broomleague:deviceCheck:v1")),
  );
  assert.ok(!Object.hasOwn(preflight, "freeRam"));
  await p.getByRole("button", { name: "ESC · SETTINGS" }).click();
  await p.locator("#audio").uncheck();
  await p.locator(".bindings summary").click();
  await p.locator('[data-action="forward"]').click();
  await p.keyboard.press("KeyI");
  await p.getByRole("button", { name: "Save & return" }).click();
  const saved = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("broomleague:settings:v1")),
  );
  assert.equal(saved.bindings.forward, "KeyI");
  assert.equal(saved.audio, false);
  const remapStart = await p.evaluate(
    () => window.broomDebug.metrics.pilots[0].z,
  );
  await p.keyboard.down("KeyI");
  await p.waitForTimeout(1400);
  await p.keyboard.up("KeyI");
  assert.ok(
    (await p.evaluate(() => window.broomDebug.metrics.pilots[0].z)) >
      remapStart,
  );
  await p
    .getByRole("button", { name: "Fly again" })
    .waitFor({ timeout: 70000 });
  assert.ok(await p.evaluate(() => window.broomDebug.metrics.courseFinished));
  await p.screenshot({ path: "docs/screenshots/m1-results.png" });
  await p.getByRole("button", { name: "Fly again" }).click();
  assert.equal(
    await p.evaluate(() => window.broomDebug.metrics.courseFinished),
    false,
  );
  await p.getByRole("button", { name: "ESC · SETTINGS" }).click();
  await p.getByRole("button", { name: "Return to main menu" }).click();
  await enter(p, "＋ Create room");
  await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await p.getByRole("button", { name: /Copy invite/ }).click();
  const invite = await p.evaluate(() => navigator.clipboard.readText());
  assert.ok(invite.includes("#invite="));
  const second = await page();
  await second.goto(invite);
  await second
    .getByRole("button", { name: /Continue/ })
    .waitFor({ timeout: 30000 });
  await second.getByRole("button", { name: /Continue/ }).click();
  await second.waitForFunction(
    () => window.broomDebug?.metrics.pilots.length === 2,
    { timeout: 45000 },
  );
  await p.waitForFunction(() => window.broomDebug?.metrics.pilots.length === 2);
  const before = await p.evaluate(() => window.broomDebug.metrics.pilots[0].z);
  await p.keyboard.down("KeyI");
  await p.waitForTimeout(2000);
  await p.keyboard.up("KeyI");
  await second.waitForTimeout(300);
  const a = await p.evaluate(() => window.broomDebug.metrics.pilots);
  const b = await second.evaluate(() => window.broomDebug.metrics.pilots);
  assert.ok(a[0].z > before);
  assert.ok(Math.abs(a[0].z - b[0].z) < 3, "two clients share server movement");
  await second.screenshot({ path: "docs/screenshots/multiplayer.png" });
  await writeFile(
    "docs/profile-headless.json",
    JSON.stringify(
      {
        milestone: "M1",
        recordedAt: new Date().toISOString(),
        browser: await browser.version(),
        environment:
          "Headless Chromium, localhost, 1440x1000; GPU/headless results are not target-device release benchmarks",
        practice: metrics,
        readiness: preflight,
        multiplayer: { clients: 2, pilotCount: b.length, movementSynced: true },
        errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: readiness, flight, rigged PBR asset, sky, remapping, full 60s trial/retry, invite URL and two-browser authoritative sync",
  );
  console.log(
    JSON.stringify({
      fps: metrics.fps,
      p95: metrics.p95,
      glbLoadMs: metrics.glbLoadMs,
    }),
  );
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
