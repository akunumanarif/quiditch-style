# Windmere · M1 art direction

Original identity: Windmere highlands; Auric ochre/brass and Verdant deep teal. Weathered masonry, slate roof tiles, timber terraces, walnut and willow broom, readable brass ring silhouettes, natural grass and cool blue/warm sun illumination.

## Implemented M1

Original modular stadium: open arches/pillars, timber stands, sandstone coping, tower cornices/slits/finials and hanging team banners. Static geometry batches by material. A continuous height field replaces discrete cones.

CC0 scanned material sets: castle_brick_01 (stone), leafy_grass (pitch), grass_ground (terrain), roof_slates_02, brown_leather. Each uses diffuse/normal/packed ARM. Kloppenheim 06 Pure Sky gives HDR sky and image-based lighting. Source and hashes are in vendor-manifest.json; local license snapshot retained.

Original Blender athlete and broom: 21,024 triangles, nine material meshes, twelve-joint skeleton, eight exported clips. Tailored coat, riding breeches/boots, glove fingers, helmet/goggles, brass fittings, short cape and individually modeled willow twigs. Flight state selects animations; reduced motion suppresses banking and trails. This is an intermediate game asset, not final photorealistic character art.

Menu uses a real in-engine High capture rather than loading the entire world before preflight.

## Art and performance gates still open

- [ ] Anatomical sculpt, final face/hair, realistic fabric/skin/wood textures and refined topology.
- [ ] Artist review of rider pose, glove contact and cape/body intersections.
- [ ] More natural terrain silhouettes, rock detail, vegetation and transitions.
- [ ] Character/environment LODs, compression (KTX2/mesh), texture budgets on target hardware.
- [ ] Role-specific interactions and sports animation clips (M2–M4).
- [ ] Crowd, flags with cloth animation, original music and environmental recordings.
- [ ] Final cinematic lighting and browser/device validation.

Current measured vertex/draw-call counts and headless frame times are reported separately in PROFILING.md. Do not describe the current pass as final AAA/photorealistic assets.
