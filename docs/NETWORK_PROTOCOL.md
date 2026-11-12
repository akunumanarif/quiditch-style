# M0 protocol

Colyseus `flight` room, max 14 seats, private matchmaking, in-memory state. No chat or score commands.

Client → server: `input` {forward,strafe,lift in [-1,1],yaw,pitch finite +/-2π,boost boolean,seq safe nonnegative integer}; `select` {team:auric|verdant, role:Striker|Warden|Keeper|Seeker}; `ping`.

Server → client: `welcome` {invite,roomId}; `snapshot` {tick,pilots}; `notice` string; `pong` server timestamp. Inputs are bounded and rate limited to 65 commands per second per seat. Timestep is 30 Hz, snapshots 15 Hz. Input silence over 300ms brakes a pilot. Server owns all positions, stamina, role assignments and arena bounds. Rendering interpolates remote nodes; no predictive input replay is implemented yet.

Invite links: `/?room=<room-id>#invite=<192-bit random secret>`. Fragment is read locally, then passed as join options over the configured WebSocket connection. Referrer policy is no-referrer. No invitation or reconnection token is logged. Capacity is enforced by framework; role capacity by shared validator.

Transport drop → allowReconnection(30) → same seat and pilot. Voluntary leave → remove pilot. All empty rooms are disposed by Colyseus. No host match controls exist in M0; full lobby/host handover belongs to M3.

## Flight smoothing

Pilot snapshots also contain server-owned `forwardAxis`, `strafeAxis`, `liftAxis` and `boostBlend` filter state. Client inputs remain intentions; movement and rate-limited shortest-arc heading are calculated by the shared simulation. Presentation uses spring-damped lean/bank and continuous synchronized clip weights. Snapshot extrapolation is bounded to 80ms, disabled during collision recovery, and clamped to arena bounds. It does not change authoritative positions. The camera follows rendered pilot position rather than jumping between raw snapshots.

## Aerodynamic state and quick turn

The shared force model adds airSpeed, pressure, wind vector, loadFactor, bank and simulation time to authoritative pilot state. Optional `quickTurn:boolean` remains backward-compatible for input validation. A rising edge is accepted only when energy >=24 and cooldown=0; the server owns turnCount, remaining time, direction/target and cooldown. All pilots in a room sample wind from the room clock. Snapshot extrapolation remains presentation-only.

## Manual roll semantics

The existing bounded `strafe` input commands manual roll. Without positive forward thrust, it does not add yaw or sideways force. With W, the server redirects the normalized thrust vector toward the actual bank angle; the velocity-alignment target uses the same travel bearing. This produces forward-diagonal movement while preserving mouse/arrow-facing yaw. Authoritative `bankVelocity` and `rollLoad` retain angular inertia and pressure feedback. Q suppresses normal bank-directed thrust during its validated reversal.

## M2 match protocol

New UI creates Colyseus `match` rooms; legacy `flight` remains for flight regression tests. Match max 14 human connections plus virtual bots filling the 14 gameplay slots. Server fixed 30 Hz; full snapshots 10 Hz. Per-client limit 70 commands/sec.

Client commands: `select {team,role}`, `ready boolean`, `configure 60|300|600` (host/lobby only), `start` (host and all humans ready), `rematch` (host/ended), `input` (same bounded flight payload), `action {id,type,aim?}`, `ping`. Action types: `interact`, `shoot`, `pass`, `block`, `strike`, `catch`. IDs must increase; role, phase, recovery, range, possession and cooldown are server checked. Finite aim vectors are normalized. Clients cannot submit goals or score.

Snapshot `{tick,pilots,match}` includes phase, host, duration/remaining/countdown, roster ready/connected/bot/role/stats, scores/winner/reason, ball ownership/trajectory, two hazards, target state and latest 12 numbered events. Score updates use ball segment crossing; catch requires Seeker within 3 m during catchable state. Input silence >350 ms returns to neutral braking. Bot decisions run 10 Hz through the same input/action validators; flight stays 30 Hz.

No new human joins after countdown; existing seats reconnect for 30 s without replaying lobby. Drop disengages flight; connected host transfers. Voluntary departure or timeout is replaced by an AI pilot at the same position/role. Lobby/rematch regenerates role-balanced bots. Live settings do not pause the server. All state remains in memory and empty rooms dispose through Colyseus.
