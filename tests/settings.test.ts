import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadSettings,
  saveSettings,
  defaultBindings,
} from "../apps/web/src/storage.ts";
const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  },
});
const write = (bindings: Record<string, string>, revision?: number) =>
  values.set(
    "broomleague:settings:v1",
    JSON.stringify({
      version: 1,
      name: "Saved Pilot",
      quality: "High",
      bindings,
      bindingsRevision: revision,
    }),
  );
test("new defaults descend with E and saved Ctrl defaults migrate without losing preferences", () => {
  values.clear();
  assert.equal(loadSettings().bindings.descend, "KeyE");
  for (const previous of ["ControlLeft", "ControlRight"]) {
    write({ ...defaultBindings, descend: previous });
    const settings = loadSettings();
    assert.equal(settings.bindings.descend, "KeyE");
    assert.equal(settings.name, "Saved Pilot");
    assert.equal(settings.quality, "High");
    saveSettings(settings);
    assert.equal(loadSettings().bindingsRevision, 2);
    assert.equal(loadSettings().bindings.descend, "KeyE");
  }
});
test("legacy E collision is resolved; deliberate subsequent remaps remain supported", () => {
  write({ ...defaultBindings, descend: "ControlLeft", quickTurn: "KeyE" });
  const migrated = loadSettings();
  assert.equal(migrated.bindings.descend, "KeyE");
  assert.notEqual(migrated.bindings.quickTurn, "KeyE");
  assert.equal(
    new Set(Object.values(migrated.bindings)).size,
    Object.keys(migrated.bindings).length,
  );
  write({ ...defaultBindings, descend: "ControlLeft" }, 2);
  assert.equal(loadSettings().bindings.descend, "ControlLeft");
});
test("corrupt settings return independent safe E bindings", () => {
  values.set("broomleague:settings:v1", "{broken");
  const settings = loadSettings();
  settings.bindings.descend = "KeyZ";
  assert.equal(loadSettings().bindings.descend, "KeyE");
});
