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
      name: "Manual roll QA",
      quality: "Low",
      audio: false,
      bindings: {
        forward: "KeyW",
        back: "KeyS",
        left: "KeyA",
        right: "KeyD",
        ascend: "Space",
        descend: "ControlLeft",
        boost: "ShiftLeft",
        recenter: "KeyR",
        quickTurn: "KeyQ",
      },
    }),
  ),
);
const get = () => page.evaluate(() => window.broomDebug.metrics);
try {
  await page.goto(base);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("broomleague:settings:v1")),
  );
  assert.equal(stored.bindings.descend, "KeyE");
  assert.equal(stored.bindingsRevision, 2);
  await page.getByRole("button", { name: "Quick practice" }).click();
  await page.getByRole("button", { name: /Continue/ }).waitFor();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.waitForFunction(() => window.broomDebug?.metrics.ready);
  await page.waitForTimeout(700);
  const start = await get();
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(1100);
  const left = await get();
  assert.ok(left.pilots[0].bank > 0.65);
  assert.ok(left.motion.bank.value > 0.5);
  assert.ok(Math.abs(left.pilots[0].yaw - start.pilots[0].yaw) < 0.01);
  assert.equal(left.pilots[0].forwardAxis, 0);
  assert.ok(
    Math.hypot(left.pilots[0].vx, left.pilots[0].vz) < 1.5,
    "A must not produce sideways thrust",
  );
  assert.equal(left.visuals.torsoSecondaryMotion, 1);
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/roll-left.png" });
  await page.keyboard.up("KeyA");
  await page.waitForTimeout(1500);
  const neutral = await get();
  assert.ok(
    Math.abs(neutral.motion.bank.value) < 0.1,
    "release should settle upright",
  );
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(1100);
  const right = await get();
  assert.ok(right.pilots[0].bank < -0.65);
  assert.ok(Math.abs(right.pilots[0].yaw - start.pilots[0].yaw) < 0.01);
  await page.screenshot({ path: "docs/screenshots/roll-right.png" });
  await page.keyboard.up("KeyD");
  await page.keyboard.down("ControlLeft");
  await page.waitForTimeout(350);
  assert.ok(
    Math.abs((await get()).pilots[0].liftAxis) < 0.001,
    "old Ctrl must not descend",
  );
  await page.keyboard.up("ControlLeft");
  await page.keyboard.down("KeyE");
  await page.waitForTimeout(900);
  const descend = await get();
  assert.ok(descend.pilots[0].liftAxis < -0.8);
  assert.ok(descend.pilots[0].vy < -1);
  await page.keyboard.up("KeyE");
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(800);
  const thrust = await get();
  assert.ok(thrust.pilots[0].forwardAxis > 0.9);
  assert.ok(
    Math.abs(thrust.pilots[0].yaw - start.pilots[0].yaw) < 0.01,
    "banked thrust must preserve the facing",
  );
  assert.ok(thrust.pilots[0].vx < -0.8, "W+A must travel diagonally left");
  assert.ok(thrust.pilots[0].vz > 2, "W+A must still advance");
  await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(1800);
  const diagonalRight = await get();
  assert.ok(diagonalRight.pilots[0].vx > 2, "W+D must travel diagonally right");
  assert.ok(diagonalRight.pilots[0].vz > 2);
  assert.ok(Math.abs(diagonalRight.pilots[0].yaw - start.pilots[0].yaw) < 0.01);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyW");
  await page.getByRole("button", { name: "ESC · SETTINGS" }).click();
  await page.locator("#motion").check();
  await page.getByRole("button", { name: "Save & return" }).click();
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(1800);
  const reduced = await get();
  assert.ok(
    reduced.motion.bank.value < -0.4,
    "reduced motion must retain intentional manual roll",
  );
  assert.equal(reduced.visuals.airflow.visible, false);
  await page.keyboard.up("KeyD");
  assert.deepEqual(errors, []);
  await writeFile(
    "docs/qa-manual-roll.json",
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        base,
        browser: await browser.version(),
        storedBindings: stored.bindings,
        left: left.pilots[0],
        right: right.pilots[0],
        neutralBank: neutral.motion.bank.value,
        descend: descend.pilots[0],
        thrust: thrust.pilots[0],
        diagonalRight: diagonalRight.pilots[0],
        fps: thrust.fps,
        reducedMotionManualBank: reduced.motion.bank.value,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      checks:
        "A/D attitude-only, no yaw/side-thrust, angular settling, rig secondary motion, persisted Ctrl-to-E migration, E descend and W+A/W+D diagonal thrust",
      leftDegrees: (left.pilots[0].bank * 180) / Math.PI,
      rightDegrees: (right.pilots[0].bank * 180) / Math.PI,
      fps: thrust.fps,
    }),
  );
} finally {
  await context.close();
  await browser.close();
}
