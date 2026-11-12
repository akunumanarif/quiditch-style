# Delivery gates · M1 continuation

The user authorized continuation beyond the initial M0 and requested more realistic assets.

## M0 foundation retained

Babylon.js-only runtime, WebGPU attempt/WebGL2 fallback, truthful readiness, local Havok WASM, private Colyseus rooms, authoritative shared flight, role capacities, reconnection grace, settings and unit/network tests. No database or accounts.

## M1 implemented

- Continuous terrain, detailed arcaded stadium and local CC0 PBR materials/HDR lighting.
- Original Blender rider and broom GLB with rig and eight clips; material batches.
- Fixed-step local practice, normalized combined speed, stamina, boost, banking and collision recovery.
- Camera floor/perimeter/post avoidance.
- Sixty-second practice trial with traversed-segment waypoint detection, result and retry.
- Original wind/waypoint audio, boost trail and reduced-motion behavior.
- Keyboard remapping, audio/settings persistence, graphics switches.
- Twelve unit/integration tests and real timed browser trial plus two-browser QA.

## M1 exit gates still open

- [ ] User playtest of flight feel and camera at different frame rates.
- [ ] Artist approval of semi-realistic rider, anatomy/clothes/pose; current art is intermediate.
- [ ] Target GPU/browser profiling, memory/LOD optimization, final performance budgets.
- [ ] Complete collider review for all art surfaces (current shared colliders cover ground, oval bounds and goal columns).

## Next

M2: authoritative ball/hazards/winged target, four functional roles, bots and a complete match. Proposed default: 600 seconds, 10 points/goal, 30/catch and catch ends match; lock rules before implementation.
M3: full lobby/start/host handover, prediction/reconciliation, refresh recovery, deployment and impaired-network tests.
M4: final realistic art/animation/audio and skippable synchronized cinematics.
M5: 14-client load/device tests, license/security review and release acceptance.

No public deployment, 14-human load test, full match, artist signoff or target-device FPS certification is claimed.

## Follow-up · cinematic flight forces

The user's latest steering prioritized stronger cinematic flight and wind feedback. Shared flight now integrates thrust, relative-air drag, wind/gusts, gravity with hover assistance, speed-dependent turns and braking. A server-validated Q maneuver reverses heading and velocity on a ~0.8s arc with 24-energy/3s cooldown. A/D now steer instead of strafing. Wind streaks, pressure/load HUD, stereo wind audio, cape playback and bounded buffeting communicate airflow. The model's magical assists and gameplay tuning are explicit in FLIGHT_PHYSICS.md. This does not advance the unimplemented M2 match scope.

## Follow-up · manual attitude and descend E

The latest control request separates A/D manual lean from heading and position. A/D now set up to ~55° roll with bounded angular acceleration/velocity, pressure-dependent damping and secondary torso lag. No manual-roll yaw, sideways thrust or implicit path steering is applied, including with W held. Mouse/arrows command heading. Q remains an explicitly requested assisted reversal. Default descend is E, and saved Ctrl bindings migrate with collision-safe preferences revisioning. Intentional roll remains visible in Reduced Motion.

32 unit/integration tests and targeted production-browser roll QA cover the new control contract; full match work remains M2.

## Clarification · W + lean produces diagonal flight

The latest user clarification changes the prior attitude-only-with-thrust behavior. A/D without thrust still only lean; W+A/D now redirect the same normalized thrust vector toward the actual manual bank angle and align velocity toward that diagonal bearing. Body/camera yaw does not rotate automatically. Angular inertia, wind, momentum, E descend and Q reversal remain supported. Unit coverage includes hover-only roll, diagonal thrust both sides at multiple facing headings, gradual response, coasting and speed bounds.
