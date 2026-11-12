import { Scene } from "@babylonjs/core/scene";
import { Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Materials/Textures/Loaders/hdrTextureLoader";
import "@babylonjs/core/Helpers/sceneHelpers";

export function buildEnvironment(scene: Scene) {
  scene.clearColor = new Color4(0.47, 0.57, 0.63, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.00085;
  scene.fogColor = new Color3(0.49, 0.56, 0.59);
  const ambient = new HemisphericLight("cool sky fill", Vector3.Up(), scene);
  ambient.intensity = 0.42;
  ambient.groundColor = new Color3(0.14, 0.12, 0.09);
  const sun = new DirectionalLight(
    "late afternoon sunlight",
    new Vector3(-0.72, -0.65, 0.36).normalize(),
    scene,
  );
  sun.position.set(120, 130, -100);
  sun.intensity = 3.2;
  sun.diffuse = new Color3(1, 0.84, 0.65);
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 450;
  sun.autoUpdateExtends = false;
  const shadow = new ShadowGenerator(1024, sun);
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadow.bias = 0.0006;
  shadow.normalBias = 0.05;
  let skyLoaded = false;
  const skyReady = new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 12000);
    const env = new HDRCubeTexture(
      "/assets/environment/windmere-sky.hdr",
      scene,
      256,
      false,
      true,
      false,
      true,
      () => {
        skyLoaded = true;
        window.clearTimeout(timeout);
        resolve();
      },
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
    );
    scene.environmentTexture = env;
    scene.environmentIntensity = 0.72;
    const sky = scene.createDefaultSkybox(env, true, 1800, 0);
    if (sky) {
      sky.isPickable = false;
      sky.name = "CC0 photographic sunrise sky";
    }
  });
  const material = (
    name: string,
    color: string,
    metallic = 0,
    roughness = 0.8,
  ) => {
    const m = new PBRMaterial(name, scene);
    m.albedoColor = Color3.FromHexString(color).toLinearSpace();
    m.metallic = metallic;
    m.roughness = roughness;
    return m;
  };
  const textureMaterials: PBRMaterial[] = [];
  function scanned(name: string, asset: string, color = "#ffffff") {
    const m = material(name, color);
    const map = (kind: string, gamma: boolean) => {
      const t = new Texture(`/assets/materials/${asset}_${kind}.jpg`, scene);
      t.gammaSpace = gamma;
      t.anisotropicFilteringLevel = 4;
      return t;
    };
    m.albedoTexture = map("diff", true);
    m.bumpTexture = map("nor_gl", false);
    m.bumpTexture.level = 0.65;
    m.invertNormalMapX = true;
    m.invertNormalMapY = true;
    m.metallicTexture = map("arm", false);
    m.useRoughnessFromMetallicTextureGreen = true;
    m.useMetallnessFromMetallicTextureBlue = true;
    m.useAmbientOcclusionFromMetallicTextureRed = true;
    m.useRoughnessFromMetallicTextureAlpha = false;
    m.metallic = 1;
    m.roughness = 1;
    textureMaterials.push(m);
    return m;
  }
  const limestone = scanned(
    "Scanned weathered limestone",
    "castle_brick_01",
    "#c8c1ab",
  );
  const turf = scanned("Living grass and soil", "leafy_grass", "#c9d0b2");
  const slate = scanned(
    "Individual slate roof tiles",
    "roof_slates_02",
    "#6e7c82",
  );
  const trim = material("Cut sandstone edging", "#918c76");
  const timber = material("Oiled timber stands", "#3c3328");
  const brass = material("Aged polished brass", "#bba36b", 0.8, 0.32);
  const white = material("Faded chalk markings", "#cbd1b5", 0, 0.98);
  const teal = material("Verdant woven banners", "#284c49");
  const ochre = material("Auric woven banners", "#967440");
  const landscape = scanned("Moorland ground", "grass_ground", "#7d8866");
  const all: Mesh[] = [];
  const casters: Mesh[] = [];
  function box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: PBRMaterial,
    cast = true,
  ) {
    const uv = [
      new Vector4(0, 0, w / 3, h / 3),
      new Vector4(0, 0, w / 3, h / 3),
      new Vector4(0, 0, d / 3, h / 3),
      new Vector4(0, 0, d / 3, h / 3),
      new Vector4(0, 0, w / 3, d / 3),
      new Vector4(0, 0, w / 3, d / 3),
    ];
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d, faceUV: uv },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = m;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    all.push(mesh);
    if (cast) casters.push(mesh);
    return mesh;
  }
  function cylinder(
    name: string,
    x: number,
    y: number,
    z: number,
    diameter: number,
    height: number,
    m: PBRMaterial,
    top = diameter,
  ) {
    const mesh = MeshBuilder.CreateCylinder(
      name,
      {
        diameterBottom: diameter,
        diameterTop: top,
        height,
        tessellation: 32,
        faceUV: [
          new Vector4(0, 0, diameter / 3, diameter / 3),
          new Vector4(0, 0, (diameter * Math.PI) / 3, height / 3),
          new Vector4(0, 0, diameter / 3, diameter / 3),
        ],
      },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = m;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    all.push(mesh);
    casters.push(mesh);
    return mesh;
  }
  // Terrain is a continuous irregular height field, not a ring of cone primitives.
  const terrain = MeshBuilder.CreateGround(
    "Highland terrain",
    { width: 1700, height: 1700, subdivisions: 120, updatable: true },
    scene,
  );
  const positions = terrain.getVerticesData("position")!;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i],
      z = positions[i + 2],
      r = Math.hypot(x * 0.95, z * 0.8);
    const edge = Math.min(1, Math.max(0, (r - 140) / 230));
    const ridges = Math.abs(
      Math.sin(x * 0.007 + z * 0.0015) +
        0.45 * Math.sin(z * 0.012 - x * 0.003) +
        0.22 * Math.sin(x * 0.029 + z * 0.019),
    );
    positions[i + 1] =
      -1.5 +
      edge * (25 + ridges * 66) +
      edge * Math.sin(x * 0.04) * Math.cos(z * 0.023) * 7;
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, terrain.getIndices()!, normals);
  terrain.updateVerticesData("position", positions);
  terrain.updateVerticesData("normal", normals);
  terrain.material = landscape;
  terrain.receiveShadows = true;
  terrain.isPickable = false;
  for (const t of [
    landscape.albedoTexture,
    landscape.bumpTexture,
    landscape.metallicTexture,
  ]) {
    if (t instanceof Texture) {
      t.uScale = 150;
      t.vScale = 150;
    }
  }
  // Dense tiling is applied to a properly UV-mapped oval pitch.
  const field = MeshBuilder.CreateDisc(
    "Maintained oval grass pitch",
    { radius: 52, tessellation: 128, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  field.rotation.x = Math.PI / 2;
  field.scaling.y = 1.92;
  field.position.y = 0.01;
  field.material = turf;
  field.receiveShadows = true;
  field.isPickable = false;
  for (const t of [turf.albedoTexture, turf.bumpTexture, turf.metallicTexture])
    if (t instanceof Texture) {
      t.uScale = 35;
      t.vScale = 65;
    }
  // Mowing bands use translucent dark material; underlying grass texture remains visible.
  const mow = material("Subtle alternating mowing direction", "#152416");
  mow.alpha = 0.1;
  mow.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  for (let i = 0; i < 12; i++) {
    const z = -88 + i * 16;
    const width = 99 * Math.sqrt(Math.max(0.01, 1 - (z / 100) ** 2));
    box("Mown turf band", 0, 0.035, z, width, 0.012, 7.5, mow, false);
  }
  function chalk(name: string, points: Vector3[]) {
    const line = MeshBuilder.CreateTube(
      name,
      { path: points, radius: 0.075, tessellation: 4 },
      scene,
    );
    line.material = white;
    line.isPickable = false;
    all.push(line);
  }
  chalk(
    "Oval boundary chalk",
    Array.from(
      { length: 129 },
      (_, i) =>
        new Vector3(
          48 * Math.cos((i * Math.PI) / 64),
          0.075,
          91 * Math.sin((i * Math.PI) / 64),
        ),
    ),
  );
  chalk("Center line", [new Vector3(-48, 0.075, 0), new Vector3(48, 0.075, 0)]);
  chalk(
    "Center circle",
    Array.from(
      { length: 65 },
      (_, i) =>
        new Vector3(
          12 * Math.cos((i * Math.PI) / 32),
          0.075,
          12 * Math.sin((i * Math.PI) / 32),
        ),
    ),
  );
  for (const side of [-1, 1])
    chalk(
      "Keeper area",
      Array.from(
        { length: 65 },
        (_, i) =>
          new Vector3(
            22 * Math.cos((i * Math.PI) / 32),
            0.075,
            side * 72 + 12 * Math.sin((i * Math.PI) / 32),
          ),
      ),
    );
  // Arcaded grandstands: buttresses and small recessed arches replace flat slab walls.
  const sectorCount = 80;
  for (let i = 0; i < sectorCount; i++) {
    const a = (i / sectorCount) * Math.PI * 2,
      x = Math.cos(a) * 59,
      z = Math.sin(a) * 109;
    const rotate = (m: Mesh) => {
      m.rotation.y = -a - Math.PI / 2;
      return m;
    };
    rotate(box("Arcade base", x, 1.1, z, 5.5, 2.2, 5, limestone));
    rotate(box("Arcade upper wall", x, 8.8, z, 5.5, 4.2, 5, limestone));
    // Inner pillars leave real open negative space below the arch.
    for (const s of [-1, 1])
      rotate(
        box(
          "Arcade pier",
          x - Math.sin(a) * s * 2.3,
          4.4,
          z + Math.cos(a) * s * 2.3,
          0.8,
          4.4,
          5,
          limestone,
        ),
      );
    const path = Array.from({ length: 13 }, (_, n) => {
      const t = (n / 12) * Math.PI;
      const tx = Math.cos(t) * 1.95;
      return new Vector3(
        x - Math.sin(a) * tx,
        5.3 + Math.sin(t) * 1.95,
        z + Math.cos(a) * tx,
      );
    });
    const arch = MeshBuilder.CreateTube(
      "Vaulted arch stone",
      { path, radius: 0.34, tessellation: 6 },
      scene,
    );
    arch.material = trim;
    arch.isPickable = false;
    all.push(arch);
    casters.push(arch);
    for (let row = 0; row < 7; row++)
      rotate(
        box(
          "Timber terrace",
          Math.cos(a) * (60 + row * 1.05),
          11 + row * 0.65,
          Math.sin(a) * (110 + row * 1.05),
          5.6,
          0.45,
          1.3,
          timber,
        ),
      );
    rotate(box("Parapet coping", x, 11, z, 5.7, 0.4, 5.4, trim));
    if (i % 5 === 0) {
      rotate(box("Stone buttress", x, 7, z, 1.2, 14, 7, limestone));
      const flag = box(
        "Hanging cloth team pennant",
        Math.cos(a) * 55.8,
        11.7,
        Math.sin(a) * 105.8,
        1.5,
        5.5,
        0.055,
        i < 40 ? teal : ochre,
        false,
      );
      flag.rotation.y = -a - Math.PI / 2;
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.17,
      x = Math.cos(a) * 70,
      z = Math.sin(a) * 123;
    cylinder("Round stone watchtower", x, 14, z, 8.5, 28, limestone);
    for (const y of [2, 12, 25, 28])
      cylinder("Carved tower cornice", x, y, z, 9.2, 0.45, trim);
    cylinder("Slate conical roof", x, 33, z, 11, 10, slate, 0.15);
    cylinder("Brass roof finial", x, 38.9, z, 0.17, 2, brass, 0.02);
    for (let j = 0; j < 8; j++) {
      const b = (j * Math.PI) / 4;
      const nx = x + Math.cos(b) * 4.29,
        nz = z + Math.sin(b) * 4.29;
      const window = box(
        "Recessed arrow slit",
        nx,
        21,
        nz,
        0.65,
        2.3,
        0.12,
        timber,
        false,
      );
      window.rotation.y = -b + Math.PI / 2;
    }
    for (let j = 0; j < 8; j++) {
      const b = (j * Math.PI) / 4;
      box(
        "Battlement",
        x + Math.cos(b) * 4.35,
        28.9,
        z + Math.sin(b) * 4.35,
        1,
        0.9,
        1,
        trim,
      );
    }
  }
  const rings: Mesh[] = [];
  for (const side of [-1, 1])
    for (let i = -1; i <= 1; i++) {
      const y = i === 0 ? 22 : 17,
        x = i * 12,
        z = side * 79;
      cylinder("Brass goal column", x, y / 2, z, 0.24, y, brass);
      cylinder("Goal column stone base", x, 0.6, z, 1.6, 1.2, trim, 1);
      for (const h of [2, y - 5, y - 1])
        cylinder("Goal column collar", x, h, z, 0.4, 0.18, brass);
      const ring = MeshBuilder.CreateTorus(
        "Regulation brass ring",
        { diameter: 7, thickness: 0.24, tessellation: 64 },
        scene,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, z);
      ring.material = brass;
      ring.isPickable = false;
      rings.push(ring);
      all.push(ring);
      casters.push(ring);
    }
  // The asset demonstration is integrated as a small courtside equipment plinth.
  const pedestal = box("Equipment plinth", -38, 1, -43, 5, 2, 5, limestone);
  // Group static geometry by material to preserve detail with bounded draw calls.
  const staticMeshes: Mesh[] = [];
  const casterIds = new Set(casters.map((m) => m.uniqueId));
  for (const m of [
    limestone,
    trim,
    slate,
    timber,
    brass,
    white,
    teal,
    ochre,
    mow,
  ]) {
    const group = all.filter(
      (mesh) => mesh.material === m && mesh !== pedestal,
    );
    if (!group.length) continue;
    const casts = group.some((mesh) => casterIds.has(mesh.uniqueId));
    const merged = Mesh.MergeMeshes(group, true, true, undefined, false, false);
    if (merged) {
      merged.name = m.name + " architectural batch";
      merged.receiveShadows = true;
      merged.isPickable = false;
      merged.freezeWorldMatrix();
      staticMeshes.push(merged);
      if (casts) shadow.addShadowCaster(merged);
    }
  }
  shadow.addShadowCaster(pedestal);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = 1;
  scene.imageProcessingConfiguration.exposure = 1.15;
  scene.imageProcessingConfiguration.contrast = 1.12;
  terrain.freezeWorldMatrix();
  field.freezeWorldMatrix();
  scene.skipPointerMovePicking = true;
  const sceneryReady = Promise.all([skyReady, scene.whenReadyAsync()]);
  return {
    sun,
    ambient,
    shadow,
    brass,
    pedestal,
    land: terrain,
    sceneryReady,
    get skyLoaded() {
      return skyLoaded;
    },
    textureMaterials,
    staticMeshes: [...staticMeshes, terrain, field, pedestal],
  };
}
