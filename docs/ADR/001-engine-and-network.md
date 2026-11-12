# ADR 001 · M0 engine and networking

Accepted: Babylon.js 9.35, TypeScript, Vite 6 (Node 22), Havok Physics V2, Colyseus 0.18. Dependencies pinned in package-lock.json. No second renderer, ORM or database.

WebGPU is attempted first. Failed initialization falls back to WebGL2. Only a texture-free menu diorama loads before readiness. A separate 45-frame microbenchmark uses 12 meshes, discards its first 8 frame samples and reports p95; it does not inspect free OS RAM. The heavy practice scene starts after Continue.

Havok is loaded from a local npm WASM asset. Its test sphere and static pedestal prove rigid-body integration; gameplay movement is shared pure TypeScript. Server uses bounded collision primitives, not Havok or browser meshes. Clients send bounded input, never arbitrary positions or scores. M0 uses full snapshots via Colyseus messages at 15 Hz; schema deltas and prediction/reconciliation are later work.

Colyseus 0.18 requires Node 22. The repo pins Node 22 as a development tool and declares engines >=22. There are 14 seats. Private rooms have 192-bit cryptographic invite secrets in the URL fragment; room IDs alone cannot join populated rooms. Client nicknames are sanitized and inserted with textContent. No personal accounts.

Automatic transport reconnection uses Colyseus SDK and server onDrop/allowReconnection(30). Consent leaves immediately remove pilots. Session token storage exists; automatic page-refresh recovery is deferred. Disconnected pilot input is cleared. Delayed inputs time out after 300 ms.

References checked during implementation:

- https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin/
- https://doc.babylonjs.com/setup/support/webGPU/
- https://docs.colyseus.io/server
- Installed SDK .d.ts and Room implementation were inspected for current lifecycle behavior.
