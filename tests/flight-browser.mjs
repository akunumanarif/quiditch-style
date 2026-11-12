import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:5173";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.addInitScript(() =>
  localStorage.setItem(
    "broomleague:settings:v1",
    JSON.stringify({
      version: 1,
      name: "Flight QA",
      quality: "Low",
      reducedMotion: false,
      sensitivity: 1,
      audio: false,
    }),
  ),
);
try {
  await page.goto(base);
  await page.getByRole("button", { name: "Quick practice" }).click();
  await page.getByRole("button", { name: /Continue/ }).waitFor();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.waitForFunction(() => window.broomDebug?.metrics.ready);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    window.flightSamples = [];
    window.flightPhase = "idle";
    window.flightRecording = true;
    const record = () => {
      if (!window.flightRecording) return;
      const d = window.broomDebug.metrics;
      if (d.motion) {
        window.flightSamples.push({
          time: performance.now(),
          phase: window.flightPhase,
          bank: d.motion.bank.value,
          lean: d.motion.pitch.value,
          yaw: d.motion.yaw,
          cameraYaw: d.camera.yaw,
          weights: { ...d.motion.weights },
          vy: d.pilots[0]?.vy,
        });
      }
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  const phase = async (name, keys, duration) => {
    await page.evaluate((p) => (window.flightPhase = p), name);
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    for (const key of keys) await page.keyboard.up(key);
  };
  await phase("right", ["KeyD"], 700);
  await phase("left", ["KeyA"], 900);
  await phase("ascend", ["Space"], 1000);
  await phase("descend", ["KeyE"], 1100);
  await phase("turn-right", ["ArrowRight", "KeyW"], 800);
  await phase("turn-left", ["ArrowLeft", "KeyW"], 800);
  await phase("settle", [], 1200);
  const data = await page.evaluate(() => {
    window.flightRecording = false;
    return {
      samples: window.flightSamples,
      metrics: window.broomDebug.metrics,
    };
  });
  assert.ok(data.samples.length > 35);
  assert.ok(data.samples.some((s) => s.bank < -0.08));
  assert.ok(data.samples.some((s) => s.bank > 0.08));
  assert.ok(data.samples.some((s) => s.lean < -0.1));
  assert.ok(data.samples.some((s) => s.lean > 0.1));
  let maxBankRate = 0,
    maxLeanRate = 0,
    maxCameraRate = 0;
  for (let n = 1; n < data.samples.length; n++) {
    const a = data.samples[n - 1],
      b = data.samples[n],
      dt = (b.time - a.time) / 1000;
    if (dt <= 0.002) continue;
    assert.ok(
      [b.bank, b.lean, b.yaw, b.cameraYaw, b.vy].every(Number.isFinite),
    );
    assert.ok(
      Math.abs(Object.values(b.weights).reduce((s, w) => s + w, 0) - 1) < 0.001,
    );
    maxBankRate = Math.max(maxBankRate, Math.abs(b.bank - a.bank) / dt);
    maxLeanRate = Math.max(maxLeanRate, Math.abs(b.lean - a.lean) / dt);
    maxCameraRate = Math.max(
      maxCameraRate,
      Math.abs(
        Math.atan2(
          Math.sin(b.cameraYaw - a.cameraYaw),
          Math.cos(b.cameraYaw - a.cameraYaw),
        ),
      ) / dt,
    );
  }
  assert.ok(maxBankRate < 3.5, `bank spike: ${maxBankRate}`);
  assert.ok(maxLeanRate < 3.5, `lift spike: ${maxLeanRate}`);
  assert.ok(maxCameraRate < 3, `camera spike: ${maxCameraRate}`);
  assert.deepEqual(errors, []);
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/smooth-flight.png" });
  await writeFile(
    "docs/qa-flight-smoothing.json",
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        base,
        browser: await browser.version(),
        maxBankRate,
        maxLeanRate,
        maxCameraRate,
        sampleCount: data.samples.length,
        metrics: data.metrics,
        errors,
        samples: data.samples,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      checks:
        "left/right banking, ascend/descend lean, camera turns, normalized crossfade weights, finite continuous motion",
      maxBankRate,
      maxLeanRate,
      maxCameraRate,
      fps: data.metrics.fps,
      samples: data.samples.length,
    }),
  );
} finally {
  await context.close();
  await browser.close();
}
