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

Unit tests compare hover trajectories with A/D versus neutral roll, verify no added movement without thrust, and require W+A/D to produce left/right forward-diagonal velocity at both north/east facing headings. They also verify gradual acceleration, retained momentum, speed bounds, visible roll, angular resistance and upright settling. Settings tests cover fresh E defaults, saved left/right Ctrl migration, collision with another E binding, persistence and corrupted preference isolation. test:roll exercises real keyboard A/D without thrust, W+A/W+D diagonal travel with unchanged facing, secondary torso rig, old Ctrl inactivity, E descent, and persisted migration in production preview.

Intentional manual roll remains visible with Reduced Motion; only automatic sway, secondary torso motion and extra camera/wind effects are suppressed. This case is covered in unit and production-browser roll checks.
