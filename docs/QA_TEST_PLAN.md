# M1 QA

`npm run check`: types, lint, thirty-four unit/integration tests and production bundle. `npm run test:browser` requires running client/server and installed Playwright Chromium. For production preview set BASE_URL=http://localhost:4173.

Unit coverage: malformed input; flight bounds/braking/stamina; diagonal speed normalization; ground/post recovery; camera floor/perimeter/occlusion; engine-vector getters; swept waypoint crossing; role limits; invitation token and safe name handling. Integration server: incorrect invitation, role conflict, movement, malformed input, reconnect identity and empty-room disposal.

Browser flow: corrupt settings fallback; readiness; actual keyboard flight; Havok; rigged GLB/eight clips; HDR sky and active geometry; remap forward to I and persist audio disabled; wait for the actual sixty-second trial; result/retry; invite to separate browser context; authoritative movement equality. Screenshots and measured profiling JSON are recorded. High art screenshots are separate captures, not a performance claim.

Manual gates: real GPU WebGPU, Safari/Firefox/Edge; pointer lock/trackpad/remapped input and reduced motion feel; sustained Low/Medium/High frame time and GPU memory; repeated join/leave and team-switch allocations; all collider edge cases; sudden server restart; 14 clients and latency/loss matrix. M2 scoring/bot/match-state tests remain deferred with those features.

## Flight smoothness regression

`npm run test:flight` (or BASE_URL=http://localhost:4173) exercises actual keyboard input for lateral reversal, ascent/descent reversal, turns and settling. It records per-render-frame bank/pitch, camera yaw and normalized animation weights to `qa-flight-smoothing.json`. It rejects nonfinite poses, abrupt angular rates and missing left/right/up/down response. Pure tests additionally cover shortest-path yaw wrapping, zero-dt stability, 30/60 Hz consistency, timely braking, reduced motion and bounded extrapolation.

## Aerodynamic regression

`npm run test:aero`: thrust and relative air pressure, visible airflow, coasting after release, Q reversing actual heading/travel with an arc, cooldown/energy, climb/bank and reduced-motion suppression. Unit tests cover quadratic q, spatial wind determinism, dive/climb speed trade, normal turn inertia and stability. Real server integration verifies both clients receive accepted turns and that spam cannot bypass cooldown. Earlier smoothness checks remain in test:flight with normal roll/pitch rate limits.

## Manual roll / E regression

Unit tests compare stationary hover with and without A/D, require bank-directed heading and curved velocity at different initial headings, verify no-throttle coasting turns and course retention, speed-dependent radius, angle-wrap/recenter/Q compatibility, smooth roll and bounded prolonged turns. Network tests drive A/D through real Colyseus clients and verify both snapshots plus stale-input course retention. test:roll checks actual keyboard hover bank, moving turns, coasting, roll-out, R recenter, rig response, Ctrl migration, E descend and reduced motion in a production build.

Intentional manual roll remains visible with Reduced Motion; only automatic sway, secondary torso motion and extra camera/wind effects are suppressed. This case is covered in unit and production-browser roll checks.

## M2 match checks

`npm run check`: 42 unit/integration tests including exact team role filling, bot-to-human slot replacement, host and readiness gates, live role/join locking, directional swept goals, reset/one-shot score, malformed and replayed actions, cooldown/range/role validation, timer winner/draw, catch ending, rematch, live bot replacement and complete 14-bot playthrough. The network test uses an isolated server on 2579 and two real Colyseus clients.

`npm run test:match`: two isolated Chromium contexts join through invite, select a role, ready/start a 60-second configured match, render 14 animated riders, observe shared scores and target catch/results, then host rematches. The match can end before timer expiry through a valid catch. Real elapsed timer expiry is covered in fixed-step simulation, not claimed from this early-ending browser fixture. Screenshots: `m2-lobby.png`, `m2-match.png`, `m2-results.png`; JSON: `profile-match-headless.json`.

Manual follow-up: play each role, mouse shooting accuracy, readable target labels, pressure feedback under load, slow/missing-packet behavior and target-device frame budget. No 14-human/public-server acceptance has been performed.

## Lobby start clarity

Host is explicitly marked `HOST` with `BELUM READY` / `READY`. The start button stays disabled until every human is ready and connected; the lobby explains whether the host must click Ready, another player is pending, or a connection is recovering. Server notices distinguish host authority from readiness, without changing the Ready requirement.

The match browser fixture checks solo host Ready/unready enabling, blocked start while a guest is unready, hidden host controls for guests, successful start after both are ready, and disabled start again after rematch. The real network test also sends invalid start commands directly and verifies the exact, distinct rejection reasons.
