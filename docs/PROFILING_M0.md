# M0 profiling report

Measured on 12 November 2026 with Playwright Chromium 158, headless, localhost, viewport 1440×1000. These are observed development results, not a hardware compatibility certificate or a representative 14-player match. Headless execution and concurrent applications affect measurements. No OS free RAM measurement was performed.

## Captured run

Latest production-preview capture: **57.2 FPS**, **p95 20.2 ms**, GLB load **47.7 ms**, WebGL2, 512 meshes. This is a short headless flight probe with two-browser invitation/sync verification.

Machine-readable latest capture: [profile-headless.json](profile-headless.json). It records renderer, sampled FPS, frame-time p95, mesh count, Havok state, measured original GLB load duration, readiness microbenchmark and two-browser sync result. Browser screenshot artifacts are in `screenshots/`.

An initial Medium/shadowed practice observation was 11.9 FPS / p95 92.1 ms. After honoring the constrained readiness result and applying Low graphics, subsequent practice runs observed approximately 56 FPS with p95 between 20.4 and 28.7 ms. These are separate short runs with different rendering settings, not a controlled optimization study. The sample GLB is only 17,076 bytes / 448 triangles; its ~53–58ms observed load is not representative of a realistic character asset.

The main JavaScript bundle decreased from ~7.48 MB (1.68 MB gzip) using engine barrel imports to ~3.03 MB (0.78 MB gzip) using targeted imports. Havok WASM is 2.09 MB raw / 0.66 MB gzip. Main JS still exceeds Vite's 2.5 MB advisory warning threshold; further code splitting and GLTF extension trimming are outstanding. No missing chunk/build error is hidden.

## Reproduce

```sh
npm run dev
# Separate terminal:
npm run test:browser
# Or after npm run build + npm run preview -w apps/web:
BASE_URL=http://localhost:4173 npm run test:browser
```

Use F3 in flight to inspect rolling FPS, p95, mesh/active counts, draw calls, renderer, physics state and RTT. Use browser performance/GPU tools for actual allocations; the game does not estimate free OS RAM from storage quota or deviceMemory.

## Open performance gates

- Real GPU, foreground Chrome/Edge and Safari/Firefox matrix.
- Validated WebGPU rendering, device loss and WebGL fallback.
- Production-quality GLB download/decode/compile benchmark and memory profiling.
- 14 simultaneous clients, RTT/loss matrix, server capacity/event-loop/RSS metrics.
- Longer sessions and repeated room changes to detect GPU or scene leaks.
- Final agreed FPS and frame-time budgets, beyond the current short localhost probe.

`npm run check` verifies types, lint, seven unit/integration tests and build. Two-browser automation verifies real invitation join and movement synchronization. Neither substitutes for the open gates above. Production dependency audit observed zero vulnerabilities; full dev-tool audit reports seven moderate advisories pending toolchain review.
