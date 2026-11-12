export type Point3 = { x: number; y: number; z: number };
export const COURSE_DURATION = 60;
export const COURSE_GATES: Point3[] = [
  { x: 0, y: 22, z: 79 },
  { x: 12, y: 17, z: 79 },
  { x: 25, y: 25, z: 20 },
  { x: 0, y: 22, z: -79 },
  { x: -12, y: 17, z: -79 },
  { x: -25, y: 30, z: -20 },
];
export function segmentDistance(point: Point3, a: Point3, b: Point3) {
  const x = b.x - a.x,
    y = b.y - a.y,
    z = b.z - a.z;
  const length = x * x + y * y + z * z;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * x + (point.y - a.y) * y + (point.z - a.z) * z) /
            length,
        ),
      )
    : 0;
  return Math.hypot(
    point.x - a.x - t * x,
    point.y - a.y - t * y,
    point.z - a.z - t * z,
  );
}
export function safeCamera(anchor: Point3, desired: Point3): Point3 {
  const camera = { x: desired.x, y: desired.y, z: desired.z };
  const edge =
    (camera.x * camera.x) / (54.5 * 54.5) + (camera.z * camera.z) / (101 * 101);
  if (edge > 1) {
    const scale = 1 / Math.sqrt(edge);
    camera.x *= scale;
    camera.z *= scale;
  }
  camera.y = Math.max(2.5, Math.min(54, camera.y));
  for (const side of [-1, 1])
    for (let i = -1; i <= 1; i++) {
      const x = i * 12,
        z = side * 79,
        h = i === 0 ? 22 : 17;
      const dx = camera.x - anchor.x,
        dz = camera.z - anchor.z,
        len = dx * dx + dz * dz;
      const t = len
        ? Math.max(
            0,
            Math.min(1, ((x - anchor.x) * dx + (z - anchor.z) * dz) / len),
          )
        : 0;
      const y = anchor.y + (camera.y - anchor.y) * t;
      if (
        y < h &&
        Math.hypot(anchor.x + t * dx - x, anchor.z + t * dz - z) < 0.8
      ) {
        const f = Math.max(0.18, t - 0.16);
        camera.x = anchor.x + dx * f;
        camera.y = anchor.y + (camera.y - anchor.y) * f;
        camera.z = anchor.z + dz * f;
      }
    }
  return camera;
}
