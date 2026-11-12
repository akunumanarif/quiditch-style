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
