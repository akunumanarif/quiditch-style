# Cinematic broom flight · force-based prototype

This pass replaces target-velocity interpolation with force integration. The goal is a controllable fantasy sporting broom with cinematic momentum, airflow feedback and rapid maneuvers. Hover suspension and the brake-turn motor are explicitly magical assists; this is not a CFD study or a measured reconstruction of film flight.

## Controls

W applies forward thrust. Release W to glide; S deploys airbraking. A/D alone command manual roll. With W, the same thrust is redirected diagonally toward the lean, without rotating the facing. Space/E apply climb/dive intent; mouse or arrows command heading. Shift with W boosts. R recenters to the current heading. Q initiates a fast 180° brake turn; Q+A chooses the opposite turn direction. Keys can be remapped. Legacy preferences automatically receive a non-conflicting quick-turn key.

## Shared authoritative simulation

`packages/shared/aerodynamics.ts` runs force steps at up to 120 Hz inside the shared 30/60 Hz simulation. Position is integrated from velocity, not assigned from an input velocity target. Clients send intentions and an optional quickTurn boolean. The server computes all flight, wind, energy and maneuver state. Private rooms use a shared room simulation clock for the same spatial/time wind field.

Prototype tuning: combined rider/broom mass 90 kg; gravity 9.81 m/s²; effective drag area 2.8 m² (including cloak/flight assist); normal/boost forward acceleration 20/36 m/s²; stability safety cap 52 m/s. Density is 1.225 exp(-height/8500). Dynamic pressure q = 0.5 rho |velocity - wind|². Drag opposes relative airflow; airbraking increases damping. These are design constants, not measured broom specifications.

Hover support counters gravity at low pitch/speed. In pitched flight support weakens so climbing spends speed and diving gains it. Steering rate falls as airspeed rises; lateral acceleration is limited to 18 m/s². Bank derives from lateral load, with spring-damped presentation and bounded normal roll rates. Wind and gusts are deterministic functions of position and time; they affect the actual relative-air drag.

## Quick turn

A rising-edge Q intention starts a smooth 180° yaw arc over ~0.8s. Velocity is rotated by the incremental arc and dissipates speed, so motion follows a curved path instead of teleporting. Thrust is reduced during the maneuver. Cost: 24 energy; cooldown: 3s from acceptance. Holding Q cannot repeat the maneuver; neither spam nor a client-provided score/position can bypass validation. Low energy or an active cooldown rejects the maneuver. Client aim aligns only after authoritative acceptance. This intentionally assisted maneuver trades realism for the requested quick reversal, with visible energy/momentum cost.

## Pressure feedback

- One updatable line batch depicts relative airflow; density/alpha increase with speed.
- Dynamic pressure drives a low-frequency wind layer, high-frequency hiss and crosswind stereo bias.
- G-load and pressure drive small continuous camera buffeting; body/camera banking indicates turns.
- Airspeed increases synchronized cloth animation speed; no cloth solver is claimed.
- HUD shows simulated airspeed, Pa, G-load and Q readiness.
- Reduced Motion disables added streaks, buffeting, vignette and automatic banking presentation; deliberate manual roll remains visible; authoritative physics remain identical.

## Validation and limits

34 unit/integration tests cover pressure scaling, wind determinism, coast vs brake, dive/climb speed trade, steering inertia, Q heading/travel reversal, path/energy/cooldown, input validation, long-run stability, state rates and server synchronization. Production-browser QA also checks real Q input and visible wind. Reports are qa-aerodynamics.json and qa-flight-smoothing.json.

Outstanding: player tuning on actual hardware, more elaborate cloth/rig reaction, full avatar/architecture collider review and large multiplayer load tests. No claim is made that these game parameters reproduce the precise behavior of a particular film.

## Manual roll with banked thrust

A/D without forward thrust produces the same hover/coast trajectory as neutral roll under identical wind. With positive forward throttle, actual bank progressively deflects the thrust bearing to the left/right. The thrust vector keeps its unit length, so diagonal input redirects propulsion rather than adding an extra strafe impulse. Velocity follows through acceleration and inertia. The velocity-alignment controller uses this deflected travel bearing, so it does not pull the diagonal flight back onto straight-ahead motion. Body/camera yaw remains controlled by mouse/arrows. Releasing W retains momentum; pressing A/D alone supplies no new lateral thrust. Q ignores this normal bank deflection during its explicitly requested reversal. The existing `strafe` wire field remains the manual roll intention; Q+A can still select the special maneuver direction.

The target is +/-0.96 radians (~55 degrees). Angular acceleration is bounded at 14 rad/s² and normal angular velocity at 2.1 rad/s. A spring torque (44 rad/s² per radian error) and damping (12 plus a bounded dynamic-pressure term) provide angular inertia and resistance. Releasing input eases back to upright; no manual yaw is integrated from A/D. Automatic bank from mouse/arrow heading changes blends out as manual roll takes control. A visual torso spring counterleans briefly during roll changes, applied after skeletal animation mixing. Roll load also affects pressure/audio feedback. Hover suspension and bank-directed propulsion remain explicit fantasy flight assists.

Descend defaults to KeyE. Settings bindings revision 2 migrates legacy Ctrl defaults, resolves an existing E collision, persists normalized settings and allows later deliberate remaps. HUD and guide use the active binding. Unit and browser evidence is in qa-manual-roll.json and roll-controls/settings tests.
