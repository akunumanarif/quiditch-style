import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:5173",
  browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.addInitScript(() =>
  localStorage.setItem(
    "broomleague:settings:v1",
    JSON.stringify({
      version: 1,
      name: "Wind QA",
      quality: "Low",
      audio: true,
      reducedMotion: false,
    }),
  ),
);
const get = () => page.evaluate(() => window.broomDebug.metrics);
try {
  await page.goto(base);
  await page.getByRole("button", { name: "Quick practice" }).click();
  await page.getByRole("button", { name: /Continue/ }).waitFor();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.waitForFunction(() => window.broomDebug?.metrics.ready);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.airSamples = [];
    window.airRecording = true;
    const tick = () => {
      if (!window.airRecording) return;
      const m = window.broomDebug.metrics,
        p = m.pilots[0];
      if (p)
        window.airSamples.push({
          time: performance.now(),
          yaw: p.yaw,
          vx: p.vx,
          vy: p.vy,
          vz: p.vz,
          pressure: p.pressure,
          energy: p.energy,
          turnCount: p.turnCount,
          turnRemaining: p.turnRemaining,
          bank: m.motion?.bank.value,
          windVisible: m.visuals.airflow.visible,
        });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1700);
  await page.keyboard.up("KeyW");
  const thrust = await get();
  assert.ok(thrust.pilots[0].airSpeed > 12);
  assert.ok(thrust.pilots[0].pressure > 80);
  assert.equal(thrust.visuals.airflow.visible, true);
  await page.waitForTimeout(200);
  const coast = await get();
  assert.ok(
    Math.hypot(coast.pilots[0].vx, coast.pilots[0].vz) > 10,
    "release must glide",
  );
  await page.keyboard.press("KeyQ");
  await page.waitForFunction(
    () => window.broomDebug.metrics.pilots[0].turnCount === 1,
  );
  await page.waitForFunction(
    () => window.broomDebug.metrics.pilots[0].turnRemaining === 0,
  );
  const turn = await get();
  const headingDelta = Math.atan2(
    Math.sin(turn.pilots[0].yaw - coast.pilots[0].yaw),
    Math.cos(turn.pilots[0].yaw - coast.pilots[0].yaw),
  );
  assert.ok(Math.abs(headingDelta) > 2.9);
  assert.ok(turn.pilots[0].vz < 0, "travel must reverse");
  assert.ok(turn.pilots[0].energy < 95);
  assert.ok(turn.pilots[0].turnCooldown > 1);
  await page.keyboard.press("KeyQ");
  await page.waitForTimeout(180);
  assert.equal(
    (await get()).pilots[0].turnCount,
    1,
    "cooldown must block second Q",
  );
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyD");
  await page.keyboard.down("Space");
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("Space");
  await page.keyboard.up("KeyW");
  const maneuver = await get();
  assert.ok(maneuver.pilots[0].pitch > 0.15);
  assert.ok(Math.abs(maneuver.pilots[0].bank) > 0.08);
  assert.ok(maneuver.pilots[0].loadFactor > 0);
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/aerodynamic-flight.png" });
  await page.getByRole("button", { name: "ESC · SETTINGS" }).click();
  await page.locator("#motion").check();
  await page.getByRole("button", { name: "Save & return" }).click();
  await page.waitForTimeout(300);
  assert.equal(
    (await get()).visuals.airflow.visible,
    false,
    "reduced motion must disable streaks/buffeting",
  );
  const samples = await page.evaluate(() => {
    window.airRecording = false;
    return window.airSamples;
  });
  assert.ok(samples.length > 35);
  assert.ok(samples.some((p) => p.turnRemaining > 0));
  assert.ok(samples.some((p) => p.windVisible));
  assert.ok(
    samples.every((p) =>
      [p.yaw, p.vx, p.vy, p.vz, p.pressure, p.bank].every(Number.isFinite),
    ),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "docs/qa-aerodynamics.json",
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        base,
        browser: await browser.version(),
        thrust: thrust.pilots[0],
        coast: coast.pilots[0],
        turn: turn.pilots[0],
        maneuver: maneuver.pilots[0],
        fps: maneuver.fps,
        sampleCount: samples.length,
        errors,
        samples,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      checks:
        "wind pressure and visible streaks, momentum, Q 180-degree travel reversal, cooldown, climb/bank, reduced motion",
      pressurePa: thrust.pilots[0].pressure,
      turnAngle: headingDelta,
      energyAfterTurn: turn.pilots[0].energy,
      samples: samples.length,
      fps: maneuver.fps,
    }),
  );
} finally {
  await context.close();
  await browser.close();
}
