import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Layer } from "@babylonjs/core/Layers/layer";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
// One local in-engine capture keeps the menu light. Full PBR scene loads after preflight.
export function menuPreview(engine: Engine | WebGPUEngine) {
  const scene = new Scene(engine);
  new FreeCamera("Menu backdrop camera", new Vector3(0, 0, -10), scene);
  const backdrop = new Layer(
    "Windmere arena capture",
    "/assets/windmere-menu.jpg",
    scene,
    true,
  );
  const render = () => {
    const aspect = engine.getRenderWidth() / engine.getRenderHeight();
    const sourceAspect = 1680 / 1050;
    backdrop.scale.set(
      Math.max(1, sourceAspect / aspect),
      Math.max(1, aspect / sourceAspect),
    );
    scene.render();
  };
  return {
    scene,
    render,
    dispose() {
      engine.stopRenderLoop(render);
      scene.dispose();
    },
  };
}
