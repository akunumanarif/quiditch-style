# M1 profiling report

Recorded 2026-11-12T06:27:00.541Z with Chromium 158.0.8127.18, headless, localhost production preview, viewport 1440×1000. This is a short development probe, not a target-device release benchmark. OS free RAM was not measured.

## Latest recorded capture

| Measurement                              | Observed                                     |
| ---------------------------------------- | -------------------------------------------- |
| Renderer / preset                        | WebGL2 / Low                                 |
| FPS, sampled engine rolling window       | 35.4                                         |
| Current-preset frame time p95            | 32.7 ms                                      |
| Current-preset frame samples             | 391                                          |
| Scene meshes / active                    | 25 / 22                                      |
| Draw calls                               | 22                                           |
| Total loaded vertices                    | 104,358                                      |
| Original rider GLB load, network + parse | 2340.2 ms                                    |
| Rider GLB                                | 1,349,828 bytes / 21,024 triangles / 9 parts |
| Skeleton / clips                         | 12 joints / 8 clips                          |
| Vendored texture/HDR files               | 16 files / 13,206,493 bytes                  |

Full data: [profile-headless.json](profile-headless.json). Old M0 report: [PROFILING_M0.md](PROFILING_M0.md). The report JSON retains prior quality segments in `profileTransitions`; rolling samples restart on graphics changes, so current Low samples are not mixed with earlier Medium frames. Cold loading and actual GLB load duration remain separately visible.

An earlier M1 run selected Medium after a lightweight probe, then observed **7.9 FPS / p95 232.2 ms** in the full scene. That result is retained in [profile-m1-before-auto.json](profile-m1-before-auto.json). Auto was corrected to observe actual raw elapsed frame time and reduce quality after sustained slow frames. Low now retains the scanned diffuse maps but substitutes simpler lighting on static scenery, disables dynamic shadows/normal detail and renders at reduced resolution. High keeps PBR, normals/ARM and shadows. This is a meaningful quality/performance tradeoff, not a claim that the realistic scene reaches 60 FPS everywhere.

## Automated evidence

`npm run check` passed strict types, lint, **12 unit/integration tests** and production build. Browser automation completed the **actual 60-second trial**, result/retry, remapping/audio persistence, Havok, rigged GLB/eight clips, photographic sky, invite and authoritative movement between two browser contexts. No uncaught JavaScript errors in that run.

High screenshots in `screenshots/m1-flight-high.png`, `m1-stadium.png` and `m1-rider.png` are art captures; they do not establish High performance. Test screenshots `practice.png`, `multiplayer.png`, `menu.png` and `m1-results.png` show the functional QA flow.

## Reproduce

```sh
npm run dev
# Other terminal:
npm run test:browser
# Production preview:
npm run build
npm run preview -w apps/web
BASE_URL=http://localhost:4173 npm run test:browser
```

The browser test waits for a real timed trial, so allow about 90 seconds. F3 shows rolling current-preset measurements in flight. The lightweight preflight is an estimate, and Auto uses real scene performance after entry.

## Open gates

Real GPU foreground profiling, WebGPU/device-loss validation, browser matrix, full memory/RSS/texture measurements, LOD/texture compression, 14-client load, network impairment, final-art review and agreed release budgets remain open. Main JS is still about 3.62 MB raw / 0.92 MB gzip and triggers Vite's bundle size advisory. Scanned materials and the 1.35 MB rider increase download size relative to M0. Runtime production dependency audit reported zero vulnerabilities; development tool advisories remain under review.

## Follow-up: smooth flight controls

The smoothness pass retains the earlier art/profile capture above as history. Current code adds eased input/boost and shortest-arc heading, critically damped body banking/lean, synchronized weighted animation clips, filtered camera aim/position, and bounded snapshot presentation.

The focused production-browser test recorded **335 motion samples**, no uncaught JavaScript errors, and passed right/left banking, ascent/descent lean, camera turns and normalized crossfade weights. Maximum observed bank/lean/camera rates were 1.46, 1.95, and 1.52 radians/second respectively. Sampled FPS was 47.9 on Low at **1280×800** headless; this is a different resolution/scenario and cannot be compared directly with the earlier 1440×1000 art benchmark.

Evidence: [qa-flight-smoothing.json](qa-flight-smoothing.json). All **18 unit/integration tests**, lint, strict types and production build passed. Subjective flight feel remains open to player feedback; these checks validate continuity and responsiveness rather than claiming every device or player preference is satisfied.

## Follow-up: wind, force integration and brake turn

The latest physics pass changes the control contract: W thrust, S airbrake, A/D steer/bank, Q assisted 180-degree brake turn. See [FLIGHT_PHYSICS.md](FLIGHT_PHYSICS.md) for the force model, units, limits and magical assistance. Previous benchmark sections remain historical and should not be read as captures of this version.

All **25 unit/integration tests**, strict types, lint and the production bundle passed. The real server test also verifies both clients receive accepted Q state and that another request cannot bypass cooldown.

Focused production browser QA at **1280×800, Low, headless Chromium** passed wind visibility/pressure, coasting, Q heading/travel reversal, speed/energy/cooldown, climb/bank and Reduced Motion suppression. The recorded sample reached **314.6 Pa** before the turn; heading reversed by pi radians; energy after the turn was **81.7%**. It recorded 236 motion samples, no uncaught JavaScript errors, and an engine FPS sample of 50.5. This is scenario-specific and not target-device or 14-player certification. [qa-aerodynamics.json](qa-aerodynamics.json).

Regular-flight continuity QA passed with 330 samples and normal bank/lean/camera maximum rates of 2.84/1.58/2.19 rad/s. Normal presentation rate caps preserve smoothness; Q intentionally permits a faster assisted roll. [qa-flight-smoothing.json](qa-flight-smoothing.json).

Airflow streaks use one updatable batch of 40 segments and integrated air travel, so changing airspeed does not jump their phase. The effects are lightweight visual feedback, not a fluid simulation. No cloth solver or precise recreation of film physics is claimed.

## Follow-up: attitude-only roll and descend E

Current control semantics supersede the earlier A/D-steering description: A/D command roll only. Mouse/arrows set heading, W applies thrust, E descends. Manual roll has bounded angular acceleration and pressure-dependent damping. A small post-animation torso spring adds counterlean during roll changes. Intentional A/D roll remains visible with Reduced Motion while extra sway and wind/camera effects are suppressed.

Strict types, lint, production build and **32 unit/integration tests** passed. The focused production-browser check passed pure roll without yaw/side-thrust, upright settling, rig secondary motion, saved Ctrl-to-E migration, E descent, W+A holding heading, and intentional roll in Reduced Motion. Measured manual angles: **54.8° left / -54.8° right**. The Low 1280×800 headless engine FPS sample was 44.4; this is not a broader device performance claim.

Evidence: [qa-manual-roll.json](qa-manual-roll.json), [left](screenshots/roll-left.png), [right](screenshots/roll-right.png). Deterministic unit comparisons show exactly matching position/velocity/heading trajectories for manual roll and neutral roll under identical thrust and wind. Wind drift and momentum can still move the pilot; A/D do not add translation.

## Clarification: W plus banked diagonal propulsion

The current control contract supersedes the earlier identical-trajectory claim while W is held: A/D alone still only roll, but W+A/D redirects the same thrust magnitude diagonally toward the actual bank angle. Body/camera-facing yaw stays under mouse/arrow control. The velocity-alignment target follows this deflected bearing, preserving the intended diagonal travel. E descent, pressure feedback and assisted Q reversal remain covered by regression checks.

**34 unit/integration tests**, strict types, lint and production build passed. Production-browser roll QA additionally passed left and right diagonal propulsion. In the north-facing test, W+A produced velocity x/z **-9.30/10.50 m/s**, while W+D produced **21.95/17.88 m/s**; both retained the original facing yaw. The earlier hover-only A/D checks still passed, as did E migration, torso motion and Reduced Motion.

Evidence: [qa-manual-roll.json](qa-manual-roll.json). The headless Low 1280×800 FPS sample was 40.8, for this scenario only.

## M2 · 14 riders / complete matches

Added an original skinned bot LOD (4,957 exported triangles, 781,284 bytes), shared simple team materials, one evaluated Flight loop per bot and no bot shadow passes. The human rider retains the original detailed model and blended clips. Balls are low-segment primitives; UI world labels are distance-culled; authoritative bot decisions run 10 Hz and flight 30 Hz.

`profile-match-headless.json` records two simultaneous 1440×1000 Chromium contexts, 2 humans + 12 bots, an actual configured 60-second match ending early by a legal catch, shared result and rematch. It is a functional and local rendering measurement, not a 14-human load test or target-device FPS certification. An initial Medium run before shared bot materials measured 5.4 FPS / p95 314.4 ms with 195 draws, demonstrating why Low and target-device profiling are still necessary. Final shared-material Low run: 15.4 FPS / p95 144.8 ms across two simultaneous contexts, 61 draws and 73 loaded materials at capture. This improves the initial run but remains below the performance target. Performance gate remains open; no 60 FPS claim.
