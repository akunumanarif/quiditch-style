import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { Pilot } from "../../../../packages/shared/index.ts";
import { clamp, damp } from "../../../../packages/shared/motion.ts";
export function createAirEffects(scene: Scene) {
  const lines = Array.from({ length: 40 }, () => [
    new Vector3(),
    new Vector3(),
  ]);
  const mesh = MeshBuilder.CreateLineSystem(
    "Relative airflow streaks",
    { lines, updatable: true },
    scene,
  );
  mesh.color = new Color3(0.83, 0.9, 0.89);
  mesh.alpha = 0;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  let time = 0,
    travel = 0,
    intensity = 0;
  function update(
    p: Pilot,
    dt: number,
    active: boolean,
    reducedMotion: boolean,
  ) {
    time += dt;
    travel += p.airSpeed * dt;
    intensity = damp(
      intensity,
      active ? clamp((p.airSpeed - 7) / 32, 0, 1) : 0,
      5,
      dt,
    );
    const visible = active && !reducedMotion && intensity > 0.04;
    mesh.isVisible = visible;
    if (visible) {
      const rx = p.vx - p.windX,
        ry = p.vy - p.windY,
        rz = p.vz - p.windZ,
        length = Math.max(1, p.airSpeed);
      for (let n = 0; n < lines.length; n++) {
        const phase = (n * 0.61803398875 + travel / 24) % 1,
          depth = 12 - phase * 24;
        const side = (n % 2 ? 1 : -1) * (2.6 + (n % 7) * 0.83),
          height = (((n * 7) % 13) - 6) * 0.62;
        const a = lines[n][0],
          b = lines[n][1];
        a.set(
          p.x + Math.sin(p.yaw) * depth + Math.cos(p.yaw) * side,
          p.y + height,
          p.z + Math.cos(p.yaw) * depth - Math.sin(p.yaw) * side,
        );
        const streak = 0.3 + intensity * 1.0;
        b.set(
          a.x - (rx / length) * streak,
          a.y - (ry / length) * streak,
          a.z - (rz / length) * streak,
        );
      }
      MeshBuilder.CreateLineSystem(
        "Relative airflow streaks",
        { lines, instance: mesh },
        scene,
      );
      mesh.alpha = 0.055 + intensity * 0.14;
    }
    const pressure = clamp(p.pressure / 1100, 0, 1),
      load = clamp((p.loadFactor - 1) / 5 + p.rollLoad * 0.3, 0, 1);
    const amplitude =
      active && !reducedMotion ? 0.012 * pressure + 0.016 * load : 0;
    return {
      x: amplitude * (Math.sin(time * 17.1) + 0.35 * Math.sin(time * 31.7)),
      y: amplitude * 0.6 * Math.sin(time * 22.3),
      roll: amplitude * 0.2 * Math.sin(time * 13.7),
      intensity,
    };
  }
  return {
    update,
    get metrics() {
      return {
        visible: mesh.isVisible,
        alpha: mesh.alpha,
        count: lines.length,
        intensity,
      };
    },
    dispose() {
      mesh.dispose();
    },
  };
}
