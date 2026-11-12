import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:4173";
const browser = await chromium.launch({ headless: true });
const contexts = [],
  errors = [];
async function page() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  contexts.push(c);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() =>
    localStorage.setItem(
      "broomleague:settings:v1",
      JSON.stringify({
        version: 1,
        quality: "Low",
        audio: false,
        name: "Test Pilot",
      }),
    ),
  );
  return p;
}
async function ready(p) {
  await p.getByRole("button", { name: /Continue/ }).waitFor({ timeout: 30000 });
  await p.getByRole("button", { name: /Continue/ }).click();
  await p.locator("#match-ready").waitFor({ timeout: 60000 });
}
try {
  await mkdir("docs/screenshots", { recursive: true });
  const host = await page();
  await host.goto(base);
  await host.locator("#bot-match").click();
  await ready(host);
  await host.screenshot({ path: "docs/screenshots/m2-lobby.png" });
  assert.equal(await host.locator(".roster-row").count(), 14);
  assert.equal(await host.locator("#match-start").isDisabled(), true);
  assert.match(await host.locator(".is-me").textContent(), /HOST.*BELUM READY/);
  assert.match(
    await host.locator("#lobby-start-status").textContent(),
    /Kamu adalah host.*Klik Ready/,
  );
  await host.locator("#match-ready").click();
  await host.waitForFunction(
    () => !document.querySelector("#match-start").disabled,
  );
  assert.match(await host.locator(".is-me").textContent(), /HOST.*READY/);
  await host.locator("#match-ready").click();
  await host.waitForFunction(
    () => document.querySelector("#match-start").disabled,
  );

  await host.locator("#match-duration").selectOption("60");
  await host.locator("#match-invite").click();
  const invite = await host.evaluate(() => navigator.clipboard.readText());
  assert.ok(invite.includes("#invite="));
  const guest = await page();
  await guest.goto(invite);
  await ready(guest);
  await host.waitForFunction(
    () =>
      window.broomDebug.metrics.match.roster.filter((m) => !m.bot).length === 2,
  );
  await guest.locator("#match-team").selectOption("verdant");
  await guest.locator("#match-role").selectOption("Seeker");
  await guest.waitForFunction(() =>
    window.broomDebug.metrics.match.roster.some(
      (m) => !m.bot && m.role === "Seeker",
    ),
  );
  console.log("QA: two-player lobby ready");
  await host.locator("#match-ready").click();
  await host.waitForFunction(
    () =>
      document.querySelector("#match-ready").getAttribute("aria-pressed") ===
      "true",
  );
  assert.equal(await host.locator("#match-start").isDisabled(), true);
  assert.match(
    await host.locator("#lobby-start-status").textContent(),
    /Menunggu Ready dari/,
  );
  assert.equal(await guest.locator("#match-start").count(), 0);
  await guest.locator("#match-ready").click();
  await host.waitForFunction(() =>
    window.broomDebug.metrics.match.roster
      .filter((m) => !m.bot)
      .every((m) => m.ready),
  );
  await host.waitForFunction(
    () => !document.querySelector("#match-start").disabled,
  );
  await host.locator("#match-start").click();
  await host.waitForFunction(
    () => window.broomDebug.metrics.match.phase === "LIVE",
  );
  await guest.waitForFunction(
    () => window.broomDebug.metrics.match.phase === "LIVE",
  );
  await host.keyboard.down("KeyW");
  await host.waitForTimeout(1800);
  await host.keyboard.up("KeyW");
  await host.keyboard.press("KeyF");
  await host.waitForTimeout(3000);
  const a = await host.evaluate(() => window.broomDebug.metrics);
  const b = await guest.evaluate(() => window.broomDebug.metrics);
  assert.equal(a.pilots.length, 14);
  assert.equal(a.visuals.riggedPilots, 14);
  assert.equal(a.match.roster.filter((m) => m.bot).length, 12);
  assert.equal(b.match.roster.length, 14);
  assert.deepEqual(a.match.scores, b.match.scores);
  assert.equal((await host.locator(".world-label").count()) > 0, true);
  await host.screenshot({ path: "docs/screenshots/m2-match.png" });
  console.log("QA: live 14 riders rendered; awaiting authoritative result");
  await host.locator("#match-rematch").waitFor({ timeout: 75000 });
  await guest.locator(".match-result").waitFor({ timeout: 8000 });
  const end = await host.evaluate(() => window.broomDebug.metrics.match);
  const endGuest = await guest.evaluate(() => window.broomDebug.metrics.match);
  assert.equal(end.phase, "ENDED");
  assert.deepEqual(end.scores, endGuest.scores);
  assert.ok(end.winner);
  await host.screenshot({ path: "docs/screenshots/m2-results.png" });
  await host.locator("#match-rematch").click();
  await host.locator("#match-ready").waitFor();
  await guest.locator("#match-ready").waitFor();
  assert.equal(await host.locator(".roster-row").count(), 14);
  assert.equal(await host.locator("#match-start").isDisabled(), true);
  await writeFile(
    "docs/profile-match-headless.json",
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        browser: await browser.version(),
        environment:
          "Headless Chromium localhost 1440x1000 Low; not target-device certification",
        players: 2,
        bots: 12,
        live: { fps: a.fps, p95: a.p95, visuals: a.visuals },
        result: end,
        rematch: true,
        errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      pilots: a.pilots.length,
      bots: 12,
      scores: end.scores,
      reason: end.reason,
      winner: end.winner,
      fps: a.fps,
      p95: a.p95,
    }),
  );
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
