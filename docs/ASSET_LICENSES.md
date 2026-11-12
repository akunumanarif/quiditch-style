# Asset provenance · M1

| Asset                                                  | Source                                                | Rights / status                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Windmere rider + broom GLB, rig, animations            | assets-source/build_pilot.py and windmere-rider.blend | Original authored geometry/animation; embedded brown_leather texture is CC0 below |
| Modular stadium, height-field terrain, ring structures | apps/web/src/environment.ts                           | Original project geometry                                                         |
| Castle Brick 01                                        | https://polyhaven.com/a/castle_brick_01               | Poly Haven CC0-1.0, diffuse/normal/ARM 1k                                         |
| Leafy Grass                                            | https://polyhaven.com/a/leafy_grass                   | Poly Haven CC0-1.0, diffuse/normal/ARM 1k                                         |
| Grass Ground                                           | https://polyhaven.com/a/grass_ground                  | Poly Haven CC0-1.0, diffuse/normal/ARM 1k                                         |
| Roof Slates 02                                         | https://polyhaven.com/a/roof_slates_02                | Poly Haven CC0-1.0, diffuse/normal/ARM 1k                                         |
| Brown Leather                                          | https://polyhaven.com/a/brown_leather                 | Poly Haven CC0-1.0, diffuse/normal/ARM 1k                                         |
| Kloppenheim 06 (Pure Sky)                              | https://polyhaven.com/a/kloppenheim_06_puresky        | CC0-1.0; Greg Zaal/Jarod Guest; 1k HDR                                            |
| windmere-menu.jpg                                      | Captured from original Babylon scene, High graphics   | Original scene with above CC0 materials; no third-party promotional image         |
| Wind audio, waypoint tones                             | apps/web/src/audio.ts                                 | Original synthesis, no external audio samples                                     |
| Geometric crest                                        | Inline SVG in main.ts                                 | Original code-generated artwork                                                   |
| DM Sans, Manrope                                       | Google Fonts                                          | SIL Open Font License; system font fallback                                       |
| Babylon.js                                             | @babylonjs/core + loaders                             | Apache-2.0; retain package notices                                                |
| Havok web runtime                                      | @babylonjs/havok                                      | MIT; retain package notices                                                       |
| Colyseus                                               | @colyseus/*                                           | MIT; retain package notices                                                       |

Verified Poly Haven asset license: https://polyhaven.com/license. Local snapshot: assets-source/vendor/polyhaven-license.html. Download URLs, SHA-256 hashes and sizes: public-assets/vendor-manifest.json. Metadata is prepared by the offline download script; the running game fetches assets locally and does not call the Poly Haven API. Powered by Poly Haven.

No ripped game/film assets, fictional house insignia or unlicensed music. Final branding/trademark clearance has not been performed. Blender source is supplied for further original asset work. The older broom-proxy.glb remains a historical M0 asset and is not used by the current rider.

## M2 bot LOD

`windmere-rider-lod.glb` is derived locally from the original `windmere-rider.blend` by `assets-source/build_lod.py`. Exported GLB: 4,957 triangles, 9 mesh parts, 12 joints, 8 animation clips (only Flight is evaluated for bots). Same original character/broom provenance and embedded CC0 leather; no new external license. Runtime bot team materials are shared and use simple diffuse shading; bot shadows are omitted to bound cost.
