# ADR 002 · M1 visuals and flight

Supersedes the original texture-free menu diorama and proxy mannequin. The original M0 architecture remains in ADR 001 for history.

The user requested continuation and more realistic assets. M1 introduces local CC0 scanned diffuse/normal/ARM materials, HDR environment lighting, continuous terrain and original detailed stadium geometry. The rider/broom is authored in Blender with twelve bones and eight animation groups, merged into nine material meshes and exported as an original GLB. Vendor URLs, licenses and hashes are recorded; no ripped assets or second renderer.

The menu displays a single local High-quality in-engine capture (~384 KB) to avoid loading the full world before readiness. It is a static game-scene image, not a cinematic or a claim of realtime menu rendering.

Medium/High use PBR and shadows; Low keeps scanned diffuse maps but substitutes simpler lighting on static architecture/terrain and reduces render resolution. This is necessary because a light readiness probe does not predict the cost of the full PBR scene. Auto observes actual raw frame time after an initial warmup and reduces to Low after three accumulated slow seconds. Profiling segments reset on a preset change, while previous segment p95s remain in profileTransitions to avoid mixing or hiding results.

Solo practice integrates flight at 60 Hz with an accumulator. Shared simulation caps combined input speed, checks ground/oval bounds/goal columns, and recovers after collision. Camera avoidance uses corresponding primitives. Swept-segment checks prevent skipping a waypoint at high speed. A 60-second local training result is explicitly separate from authoritative match scoring, which is M2.

Audio is original synthesis. Settings v1 accepts new optional audio/binding fields with backward-compatible defaults. Reduced motion suppresses banking, FOV expansion and trails. These additions do not claim M2 match mechanics or a finished realism/performance gate.
