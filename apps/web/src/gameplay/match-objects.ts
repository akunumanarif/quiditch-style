import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { MatchSnapshot } from "../../../../packages/shared/match.ts";
import type { Pilot } from "../../../../packages/shared/index.ts";
export function createMatchObjects(scene: Scene) {
  const material = (name: string, hex: string, glow = false) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.8, 0.7, 0.5);
    if (glow) m.emissiveColor = m.diffuseColor.scale(0.4);
    return m;
  };
  const red = material("Match ball · oxblood leather", "#b83428");
  const iron = material("Hazard · dark iron", "#252a35");
  const gold = material("Aurel Wing · luminous gold", "#edbd50", true);
  const ball = MeshBuilder.CreateSphere(
    "Scoring ball",
    { diameter: 1, segments: 16 },
    scene,
  );
  ball.material = red;
  const hazards = [0, 1].map((i) => {
    const m = MeshBuilder.CreateSphere(
      "Hazard " + i,
      { diameter: 0.85, segments: 12 },
      scene,
    );
    m.material = iron;
    return m;
  });
  const target = MeshBuilder.CreateSphere(
    "Aurel Wing",
    { diameter: 0.42, segments: 12 },
    scene,
  );
  target.material = gold;
  const wings = [-1, 1].map((side) => {
    const w = MeshBuilder.CreateSphere(
      "Aurel wing " + side,
      { diameter: 1, segments: 8 },
      scene,
    );
    w.scaling.set(0.65, 0.045, 0.2);
    w.position.x = side * 0.38;
    w.parent = target;
    w.material = gold;
    return { w, side };
  });
  const meshes = [ball, ...hazards, target];
  meshes.forEach((m) => {
    m.isVisible = false;
    m.isPickable = false;
  });
  const labels = document.createElement("div");
  labels.id = "match-world-labels";
  document.body.append(labels);
  const nodes = new Map<string, HTMLDivElement>();
  let time = 0;
  function label(
    id: string,
    text: string,
    p: { x: number; y: number; z: number },
    color: string,
  ) {
    let el = nodes.get(id);
    if (!el) {
      el = document.createElement("div");
      el.className = "world-label";
      labels.append(el);
      nodes.set(id, el);
    }
    el.textContent = text;
    el.style.color = color;
    const camera = scene.activeCamera!;
    const projected = Vector3.Project(
      new Vector3(p.x, p.y + 1.6, p.z),
      Matrix.Identity(),
      scene.getTransformMatrix(),
      camera.viewport.toGlobal(
        scene.getEngine().getRenderWidth(),
        scene.getEngine().getRenderHeight(),
      ),
    );
    el.hidden =
      projected.z < 0 ||
      projected.z > 1 ||
      Vector3.Distance(camera.position, new Vector3(p.x, p.y, p.z)) > 105;
    el.style.left = `${(projected.x / scene.getEngine().getRenderWidth()) * innerWidth}px`;
    el.style.top = `${(projected.y / scene.getEngine().getRenderHeight()) * innerHeight}px`;
  }
  return {
    update(
      s: MatchSnapshot | undefined,
      pilots: Pilot[],
      self: string,
      dt: number,
    ) {
      time += dt;
      labels.hidden = !s || s.phase === "LOBBY" || s.phase === "ENDED";
      const live = s && (s.phase === "LIVE" || s.phase === "COUNTDOWN");
      meshes.forEach((m) => (m.isVisible = !!live));
      if (!s || !live) return;
      const move = (m: typeof ball, p: { x: number; y: number; z: number }) => {
        const dest = new Vector3(p.x, p.y, p.z);
        if (Vector3.Distance(m.position, dest) > 20) m.position.copyFrom(dest);
        else
          m.position.copyFrom(
            Vector3.Lerp(m.position, dest, 1 - Math.exp(-20 * dt)),
          );
        m.rotation.y += dt * 2;
      };
      move(ball, s.ball);
      ball.isVisible = s.ball.mode !== "reset";
      hazards.forEach((m, i) => move(m, s.hazards[i]));
      move(target, s.target);
      target.isVisible = !["hidden", "captured"].includes(s.target.state);
      wings.forEach(
        ({ w, side }) => (w.rotation.z = side * Math.sin(time * 38) * 0.65),
      );
      const active = new Set<string>();
      for (const p of pilots) {
        if (p.id === self) continue;
        active.add(p.id);
        label(
          p.id,
          `${p.name}${p.bot ? " · BOT" : ""} / ${p.role}`,
          p,
          p.team === "auric" ? "#f3cf86" : "#84d8c1",
        );
      }
      if (ball.isVisible) {
        active.add("ball");
        label(
          "ball",
          s.ball.owner ? "● BOLA / CARRIER" : "● BOLA",
          s.ball,
          "#ff917d",
        );
      }
      if (target.isVisible) {
        active.add("target");
        label(
          "target",
          s.target.state === "catchable" ? "✦ TANGKAP" : "✦ AUREL WING",
          s.target,
          "#ffe18b",
        );
      }
      for (const [id, el] of nodes)
        if (!active.has(id)) {
          el.remove();
          nodes.delete(id);
        }
    },
    dispose() {
      labels.remove();
      meshes.forEach((m) => m.dispose());
      [red, iron, gold].forEach((m) => m.dispose());
    },
  };
}
