# Cinematic broom flight · force-based prototype

This pass replaces target-velocity interpolation with force integration. The goal is a controllable fantasy sporting broom with cinematic momentum, airflow feedback and rapid maneuvers. Hover suspension and the brake-turn motor are explicitly magical assists; this is not a CFD study or a measured reconstruction of film flight.

## Controls

W applies forward thrust. Release W to glide; S deploys airbraking. A/D command manual roll and, while moving, a coordinated bank-to-turn arc. The nose and velocity turn together, including while coasting without W. Below 3 m/s horizontal speed, A/D changes attitude without turning the heading. Space/E apply climb/dive intent; mouse or arrows command heading. Shift with W boosts. R recenters to the current heading. Q initiates a fast 180° brake turn; Q+A chooses the opposite turn direction. Keys can be remapped. Legacy preferences automatically receive a non-conflicting quick-turn key.

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

52 unit/integration tests cover pressure scaling, wind determinism, coast vs brake, dive/climb speed trade, steering inertia, Q heading/travel reversal, path/energy/cooldown, input validation, long-run stability, state rates and server synchronization. Production-browser QA also checks real Q input and visible wind. Reports are qa-aerodynamics.json and qa-flight-smoothing.json.

Outstanding: player tuning on actual hardware, more elaborate cloth/rig reaction, full avatar/architecture collider review and large multiplayer load tests. No claim is made that these game parameters reproduce the precise behavior of a particular film.

## Coordinated bank-to-turn

This supersedes the previous fixed-facing diagonal-thrust model. W supplies normalized forward thrust along the current nose; A/D roll creates centripetal acceleration from the actual bank, and accumulates heading in the direction of the turn. No W input is required while coasting. Steering authority fades from zero at 3 m/s horizontal speed to full at 8 m/s, preserving stationary hover. Nominal yaw rate is `-g * tan(bank) * 1.2 / max(horizontalSpeed, 8)`, multiplied by steering/low-speed authority and bounded to 1.25 rad/s. Combined lateral acceleration stays bounded to 18 m/s². A faster rider therefore needs a wider radius at equal bank. Magical vertical support prevents an unintended altitude loss during a level bank.

Roll target remains +/-0.96 radians (~55 degrees), with 14 rad/s² torque and 2.1 rad/s roll-rate bounds, pressure damping and torso lag. Input/roll inertia builds the curve gradually; steering authority fades during roll-out. Automatic presentation bank from mouse/arrow turns cannot sustain its own steering loop. Releasing A/D levels the broom while preserving the new course.

Authoritative `bankHeadingOffset` accumulates only the bank contribution. Input yaw is a mouse/arrow reference plus that offset; a held mouse reference no longer pulls the broom back toward the pre-turn heading. `controlYaw` performs the inverse mapping for R, Q completion, spawn, stale-input braking and bots that replace human riders. `bankSteering` and `bankTurnRate` expose filtered steering and actual bank yaw rate. Aim uses the same world-heading mapping. Q temporarily suppresses ordinary bank steering and keeps its explicit reversal/cooldown.

Descend defaults to KeyE. Settings bindings revision 2 migrates legacy Ctrl defaults, resolves an existing E collision, persists normalized settings and allows later deliberate remaps. HUD and guide use the active binding. Unit and browser evidence is in qa-manual-roll.json and roll-controls/settings tests.

## M2 integration

The match preserves the current bank-to-turn + nose-directed W thrust, E descend, wind/pressure and Q reversal contract. Match bots submit the same bounded FlightInput and run `stepFlight` at server 30 Hz; they receive no position teleports or speed bonus. `F` is the default contextual match interaction (configurable in keyboard settings); left click issues the primary role action after mouse lock. Contacts/hazard hits can reduce speed, energy and cause short recovery. Entering Settings disengages human input while the server match continues.
