export const defaultBindings = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  ascend: "Space",
  descend: "KeyE",
  boost: "ShiftLeft",
  recenter: "KeyR",
  quickTurn: "KeyQ",
  interact: "KeyF",
};
export type FlightAction = keyof typeof defaultBindings;
export type Settings = {
  version: 1;
  bindingsRevision: 2;
  name: string;
  quality: "Auto" | "Low" | "Medium" | "High";
  sensitivity: number;
  reducedMotion: boolean;
  audio: boolean;
  bindings: Record<FlightAction, string>;
};
export const defaults: Settings = {
  version: 1,
  bindingsRevision: 2,
  name: "Skyfarer",
  quality: "Auto",
  sensitivity: 1,
  reducedMotion: false,
  audio: true,
  bindings: { ...defaultBindings },
};
function readBindings(
  candidate: Record<string, unknown> | undefined,
  migrateDescend: boolean,
): Record<FlightAction, string> {
  const result = Object.fromEntries(
    Object.entries(defaultBindings).map(([action, key]) => [
      action,
      typeof candidate?.[action] === "string" &&
      /^(Key[A-Z]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right))$/.test(
        candidate[action] as string,
      )
        ? candidate[action]
        : key,
    ]),
  ) as Record<FlightAction, string>;
  // Upgrade the previous Ctrl default even for already-saved profiles.
  if (
    migrateDescend &&
    (candidate?.descend === undefined ||
      candidate.descend === "ControlLeft" ||
      candidate.descend === "ControlRight")
  ) {
    const previous = result.descend;
    result.descend = "KeyE";
    for (const action of Object.keys(result) as FlightAction[])
      if (action !== "descend" && result[action] === "KeyE") {
        const otherKeys = new Set(
          Object.entries(result)
            .filter(([key]) => key !== action)
            .map(([, value]) => value),
        );
        result[action] = [
          defaultBindings[action],
          previous,
          "KeyF",
          "KeyZ",
          "KeyX",
          "KeyC",
          "KeyB",
          "KeyN",
          "KeyM",
          "KeyV",
          "KeyP",
        ].find((key) => !otherKeys.has(key))!;
      }
  }
  const used = new Set(
    Object.entries(result)
      .filter(([action]) => action !== "quickTurn")
      .map(([, key]) => key),
  );
  if (used.has(result.quickTurn))
    result.quickTurn = [
      "KeyQ",
      "KeyZ",
      "KeyX",
      "KeyC",
      "KeyB",
      "KeyN",
      "KeyM",
      "KeyV",
      "KeyP",
    ].find((key) => !used.has(key))!;
  return result;
}
export function loadSettings(): Settings {
  try {
    const s = JSON.parse(
      localStorage.getItem("broomleague:settings:v1") || "null",
    );
    if (!s || s.version !== 1)
      return { ...defaults, bindings: { ...defaultBindings } };
    return {
      version: 1,
      bindingsRevision: 2,
      name: typeof s.name === "string" ? s.name.slice(0, 20) : defaults.name,
      quality: ["Auto", "Low", "Medium", "High"].includes(s.quality)
        ? s.quality
        : "Auto",
      sensitivity:
        typeof s.sensitivity === "number" && Number.isFinite(s.sensitivity)
          ? Math.max(0.2, Math.min(3, s.sensitivity))
          : 1,
      reducedMotion: s.reducedMotion === true,
      audio: s.audio !== false,
      bindings: readBindings(s.bindings, s.bindingsRevision !== 2),
    };
  } catch {
    return { ...defaults, bindings: { ...defaultBindings } };
  }
}
export function saveSettings(s: Settings) {
  try {
    localStorage.setItem("broomleague:settings:v1", JSON.stringify(s));
  } catch {
    /* Preferences are optional. */
  }
}
