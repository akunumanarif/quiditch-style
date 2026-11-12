import "@babylonjs/loaders/glTF";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/core/Physics/physicsEngineComponent";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import type {
  AssetContainer,
  InstantiatedEntries,
} from "@babylonjs/core/assetContainer";
import Havok from "@babylonjs/havok";
import havokWasm from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { createAirEffects } from "./gameplay/air-effects";
import { buildEnvironment } from "./environment";
import type { Pilot } from "../../../packages/shared/index.ts";
import {
  createFlightPose,
  stepFlightPose,
  FLIGHT_CLIPS,
  type FlightPose,
} from "./gameplay/flight-pose";

export async function makeEngine(canvas: HTMLCanvasElement) {
  if (await WebGPUEngine.IsSupportedAsync) {
    try {
      const e = new WebGPUEngine(canvas, { antialias: true });
      await e.initAsync();
      return { engine: e, renderer: "WebGPU" };
    } catch {
      /* WebGL2 fallback */
    }
  }
  const gl = canvas.getContext("webgl2");
  if (!gl)
    throw new Error(
      "WebGL2 tidak tersedia. Aktifkan akselerasi grafis atau coba browser desktop lain.",
    );
  return {
    engine: new Engine(gl, true, { stencil: true }),
    renderer: "WebGL2",
  };
}
type Rider = {
  root: TransformNode;
  model: InstantiatedEntries;
  team: string;
  bot: boolean;
  pose: FlightPose;
  spine?: TransformNode;
  trail: TrailMesh;
};
export function buildArena(
  engine: Engine | WebGPUEngine,
  canvas: HTMLCanvasElement,
) {
  const scene = new Scene(engine);
  const camera = new FreeCamera(
    "flight camera",
    new Vector3(102, 65, -112),
    scene,
  );
  camera.minZ = 0.15;
  camera.maxZ = 2200;
  camera.fov = 0.83;
  camera.inputs.clear();
  camera.setTarget(new Vector3(0, 8, 8));
  const environment = buildEnvironment(scene);
  const airEffects = createAirEffects(scene);
  const sphere = MeshBuilder.CreateSphere(
    "Havok brass training ball",
    { diameter: 1.5, segments: 24 },
    scene,
  );
  sphere.position.set(-38, 9, -43);
  sphere.material = environment.brass;
  let physics = "Loading";
  let glbLoadMs = 0;
  let glbStatus = "Loading";
  let container: AssetContainer | undefined;
  let botContainer: AssetContainer | undefined;
  const botAssetReady = LoadAssetContainerAsync(
    "/assets/windmere-rider-lod.glb",
    scene,
  ).then((a) => {
    botContainer = a;
  });
  const start = performance.now();
  const assetReady = LoadAssetContainerAsync(
    "/assets/windmere-rider.glb",
    scene,
  )
    .then((asset) => {
      container = asset;
      glbLoadMs = performance.now() - start;
      glbStatus = "Loaded rigged rider PBR GLB";
    })
    .catch((error: unknown) => {
      glbStatus = "Failed";
      throw error;
    });
  const physicsReady = Havok({ locateFile: () => havokWasm })
    .then((h) => {
      if (scene.isDisposed) return;
      scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, h));
      new PhysicsAggregate(
        environment.pedestal,
        PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.55 },
        scene,
      );
      new PhysicsAggregate(
        sphere,
        PhysicsShapeType.SPHERE,
        { mass: 1, restitution: 0.65 },
        scene,
      );
      physics = "Havok V2";
    })
    .catch((error: unknown) => {
      physics = "Unavailable";
      console.error("Havok initialization failed", error);
    });
  const pipeline = new DefaultRenderingPipeline(
    "Windmere photographic exposure",
    true,
    scene,
    [camera],
  );
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = false;
  const instrument = new SceneInstrumentation(scene);
  instrument.captureFrameTime = true;
  instrument.captureRenderTime = true;
  const riders = new Map<string, Rider>();
  const trailMaterial = new StandardMaterial("Subtle wind contrail", scene);
  trailMaterial.disableLighting = true;
  trailMaterial.emissiveColor = new Color3(0.55, 0.68, 0.63);
  trailMaterial.alpha = 0.23;
  trailMaterial.backFaceCulling = false;
  const botMaterials = new Map<string, StandardMaterial>();
  function createRider(p: Pilot): Rider | undefined {
    if (!container) return;
    const root = new TransformNode("pilot-" + p.id, scene);
    root.position.set(p.x, p.y, p.z);
    const model = (
      p.bot && botContainer ? botContainer : container
    ).instantiateModelsToScene((name) => p.id + "-" + name, !p.bot, {
      doNotInstantiate: true,
    });
    for (const n of model.rootNodes) {
      n.parent = root;
      if (n instanceof TransformNode) {
        n.rotationQuaternion = null;
        n.rotation.y = 0;
      }
    }
    const meshes = root.getChildMeshes();
    for (const m of meshes) {
      m.isPickable = false;
      m.receiveShadows = true;
      if (!p.bot) environment.shadow.addShadowCaster(m);
      const mat = m.material;
      if (p.bot && mat instanceof PBRMaterial) {
        const key = p.team + mat.name;
        let simple = botMaterials.get(key);
        if (!simple) {
          simple = new StandardMaterial("bot " + key, scene);
          simple.diffuseTexture = mat.albedoTexture;
          simple.diffuseColor = mat.name.includes("TeamFabric")
            ? Color3.FromHexString(
                p.team === "auric" ? "#8d652f" : "#315d56",
              ).toLinearSpace()
            : mat.albedoColor.clone();
          simple.specularColor = new Color3(0.08, 0.08, 0.07);
          botMaterials.set(key, simple);
        }
        m.material = simple;
      }
      if (
        !p.bot &&
        mat instanceof PBRMaterial &&
        mat.name.includes("TeamFabric")
      ) {
        mat.albedoColor = Color3.FromHexString(
          p.team === "auric" ? "#8d652f" : "#315d56",
        ).toLinearSpace();
        mat.roughness = 0.97;
      }
    }
    const socket = new TransformNode("broom trail socket", scene);
    socket.parent = root;
    socket.position.set(0, -0.1, -1.8);
    const trail = new TrailMesh("broom slipstream", socket, scene, {
      diameter: 0.08,
      length: 20,
      segments: 12,
      sections: 3,
    });
    trail.material = trailMaterial;
    trail.isPickable = false;
    trail.isVisible = false;
    const pose = createFlightPose(p);
    // Keep every clip on the same timeline; weights change without stopping/resetting bones.
    const base = model.animationGroups.find((group) =>
      group.name.endsWith("Flight"),
    );
    for (const group of model.animationGroups) {
      group.weight = group === base ? 1 : 0;
      if (!p.bot || group === base) group.start(true, 1);
    }
    if (base?.animatables[0])
      for (const group of model.animationGroups)
        if (!p.bot && group !== base)
          group.syncAllAnimationsWith(base.animatables[0]);
    const spine =
      model.skeletons[0]?.bones
        .find((bone) => bone.name.endsWith("chest"))
        ?.getTransformNode() ?? undefined;
    const r = { root, model, team: p.team, bot: !!p.bot, trail, pose, spine };
    riders.set(p.id, r);
    return r;
  }
  function removeRider(r: Rider) {
    r.trail.stop();
    r.trail.dispose();
    const materials = new Set(
      r.root.getChildMeshes().map((mesh) => mesh.material),
    );
    for (const m of r.root.getChildMeshes())
      environment.shadow.removeShadowCaster(m);
    r.model.dispose();
    if (!r.bot)
      for (const material of materials) material?.dispose(false, false);
    r.root.dispose();
  }
  let motionReduced = false;
  let q = "Medium";
  const torsoOffset = new Quaternion();
  const torsoObserver = scene.onAfterAnimationsObservable.add(() => {
    if (motionReduced) return;
    for (const rider of riders.values()) {
      const rotation = rider.spine?.rotationQuaternion;
      if (rotation) {
        Quaternion.RotationYawPitchRollToRef(
          0,
          0,
          rider.pose.torsoLean.value,
          torsoOffset,
        );
        rotation.multiplyToRef(torsoOffset, rotation);
      }
    }
  });
  function updatePilots(pilots: Pilot[], dt: number, snapshotAge = 0) {
    const ids = new Set(pilots.map((p) => p.id));
    for (const [id, r] of riders)
      if (!ids.has(id)) {
        removeRider(r);
        riders.delete(id);
      }
    for (const p of pilots) {
      let r = riders.get(p.id);
      if (r && r.team !== p.team) {
        removeRider(r);
        riders.delete(p.id);
        r = undefined;
      }
      r = r || createRider(p);
      if (!r) continue;
      stepFlightPose(r.pose, p, dt, motionReduced, snapshotAge);
      r.root.position.set(r.pose.x, r.pose.y, r.pose.z);
      r.root.rotation.set(r.pose.pitch.value, r.pose.yaw, r.pose.bank.value);
      r.trail.isVisible = Math.hypot(p.vx, p.vz) > 27 && !motionReduced;
      for (const group of r.model.animationGroups) {
        const clip = FLIGHT_CLIPS.find((name) => group.name.endsWith(name));
        if (clip && !p.bot)
          group.setWeightForAllAnimatables(r.pose.weights[clip]);
        group.speedRatio = 1 + Math.min(1.4, p.airSpeed / 30);
      }
    }
  }
  const lowMaterials = new Map<PBRMaterial, StandardMaterial>();
  const originals = new Map(
    environment.staticMeshes.map((mesh) => [mesh, mesh.material]),
  );
  function quality(preset: string) {
    q = preset;
    const low = q === "Low";
    engine.setHardwareScalingLevel(low ? 1.85 : q === "High" ? 1 : 1.15);
    environment.sun.shadowEnabled = !low;
    environment.sun.intensity = low ? 1.5 : 3.2;
    environment.ambient.intensity = low ? 0.65 : 0.42;
    for (const [mesh, original] of originals) {
      if (!low || !(original instanceof PBRMaterial)) {
        mesh.material = original;
        continue;
      }
      let simple = lowMaterials.get(original);
      if (!simple) {
        simple = new StandardMaterial(original.name + " Low", scene);
        simple.diffuseTexture = original.albedoTexture;
        simple.diffuseColor = original.albedoColor.clone();
        simple.specularColor = new Color3(0.04, 0.04, 0.04);
        simple.alpha = original.alpha;
        simple.backFaceCulling = original.backFaceCulling;
        lowMaterials.set(original, simple);
      }
      mesh.material = simple;
    }
    pipeline.fxaaEnabled = !low;
    scene.environmentIntensity = low ? 0.65 : 0.72;
    for (const m of environment.textureMaterials) m.disableBumpMap = low;
  }
  quality("Medium");
  return {
    scene,
    camera,
    instrument,
    updatePilots,
    updateAirflow(p: Pilot, dt: number, active: boolean, reduced: boolean) {
      return airEffects.update(p, dt, active, reduced);
    },
    getPilotPose(id: string) {
      return riders.get(id)?.pose;
    },
    quality,
    physicsReady,
    assetReady: Promise.all([assetReady, botAssetReady]),
    sceneryReady: environment.sceneryReady,
    setReducedMotion(value: boolean) {
      motionReduced = value;
    },
    get glbLoadMs() {
      return glbLoadMs;
    },
    get glbStatus() {
      return glbStatus;
    },
    get physics() {
      return physics;
    },
    get sphereY() {
      return sphere.position.y;
    },
    get visualMetrics() {
      return {
        skyLoaded: environment.skyLoaded,
        airflow: airEffects.metrics,
        riggedPilots: riders.size,
        torsoSecondaryMotion: [...riders.values()].filter((r) => r.spine)
          .length,
        animationClips: container?.animationGroups.map((a) => a.name) || [],
        materials: scene.materials.length,
        quality: q,
        drawCalls: engine._drawCalls.current,
        vertices: scene.getTotalVertices(),
        activeMeshes: scene.getActiveMeshes().length,
      };
    },
    dispose() {
      for (const r of riders.values()) removeRider(r);
      scene.onAfterAnimationsObservable.remove(torsoObserver);
      airEffects.dispose();
      container?.dispose();
      botContainer?.dispose();
      for (const mat of botMaterials.values()) mat.dispose(false, false);
      instrument.dispose();
      pipeline.dispose();
      environment.shadow.dispose();
      scene.dispose();
    },
    canvas,
    land: environment.land,
  };
}
