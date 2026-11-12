/** Frame-rate independent filters. Angles are radians; dt is seconds. */
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const damp = (
  value: number,
  target: number,
  response: number,
  dt: number,
) => target + (value - target) * Math.exp(-response * Math.max(0, dt));
export function angleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
export function dampAngle(
  value: number,
  target: number,
  response: number,
  dt: number,
  maxRate = Infinity,
) {
  if (dt <= 0) return value;
  const delta = angleDelta(value, target);
  const step = clamp(
    delta * (1 - Math.exp(-response * Math.max(0, dt))),
    -maxRate * dt,
    maxRate * dt,
  );
  return Math.atan2(Math.sin(value + step), Math.cos(value + step));
}
export type Spring = { value: number; velocity: number };
/** Exact critically damped spring: stable on slow frames, with continuous velocity. */
export function spring(
  state: Spring,
  target: number,
  frequency: number,
  dt: number,
) {
  const delta = state.value - target,
    coefficient = state.velocity + frequency * delta,
    decay = Math.exp(-frequency * Math.max(0, dt));
  state.value = target + (delta + coefficient * dt) * decay;
  state.velocity = (state.velocity - frequency * coefficient * dt) * decay;
  return state.value;
}
