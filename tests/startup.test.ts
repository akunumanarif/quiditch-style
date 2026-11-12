import { createServer } from "node:http";
import type { Socket } from "node:net";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serverEndpoint,
  withDeadline,
  openGameRoom,
} from "../apps/web/src/startup.ts";

test("production never invents a backend port on the static frontend", () => {
  assert.throws(
    () =>
      serverEndpoint(undefined, {
        hostname: "saputerbang.numanarif.dev",
        protocol: "https:",
      }),
    /VITE_SERVER_URL/,
  );
  assert.throws(
    () =>
      serverEndpoint("  ", {
        hostname: "preview.netlify.app",
        protocol: "https:",
      }),
    /VITE_SERVER_URL/,
  );
});
test("explicit deployment endpoint is normalized and rejects mixed content or credentials", () => {
  const page = { hostname: "game.example", protocol: "https:" };
  assert.equal(
    serverEndpoint(" https://backend.example/ ", page),
    "wss://backend.example",
  );
  assert.equal(
    serverEndpoint("wss://backend.example/game/", page),
    "wss://backend.example/game",
  );
  for (const invalid of [
    "http://backend.example",
    "ws://backend.example",
    "localhost:2567",
    "ftp://backend.example",
    "https://user:pass@backend.example",
    "https://backend.example?token=secret",
    "https://backend.example/#bad",
  ])
    assert.throws(() => serverEndpoint(invalid, page));
});
test("localhost preview and development LAN retain the local backend", () => {
  assert.equal(
    serverEndpoint(undefined, { hostname: "localhost", protocol: "http:" }),
    "ws://localhost:2567",
  );
  assert.equal(
    serverEndpoint(undefined, { hostname: "127.0.0.1", protocol: "http:" }),
    "ws://127.0.0.1:2567",
  );
  assert.equal(
    serverEndpoint(undefined, { hostname: "[::1]", protocol: "http:" }),
    "ws://[::1]:2567",
  );
  assert.equal(
    serverEndpoint(
      undefined,
      { hostname: "192.168.1.8", protocol: "http:" },
      true,
    ),
    "ws://192.168.1.8:2567",
  );
});
test("startup deadlines release the UI, clean up and do not adopt late results", async () => {
  let cancelled = 0,
    lateResolve!: (n: number) => void;
  const operation = new Promise<number>((resolve) => {
    lateResolve = resolve;
  });
  await assert.rejects(
    withDeadline(operation, 10, "timed out", () => cancelled++),
    /timed out/,
  );
  lateResolve(7);
  await Promise.resolve();
  assert.equal(cancelled, 1);
  assert.equal(
    await withDeadline(Promise.resolve(42), 100, "timeout", () => cancelled++),
    42,
  );
  await assert.rejects(
    withDeadline(Promise.reject(new Error("invalid invite")), 100, "timeout"),
    /invalid invite/,
  );
  assert.equal(cancelled, 1);
});

test("connection deadline aborts stalled matchmaking HTTP and WebSocket handshakes", async () => {
  for (const handshake of [false, true]) {
    const sockets = new Set<Socket>();
    let upgraded = false;
    const server = createServer((_req, res) => {
      if (handshake) {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            name: "match",
            roomId: "test-room",
            sessionId: "test-seat",
            processId: "test-process",
          }),
        );
      }
    });
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    server.on("upgrade", () => {
      upgraded = true;
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as { port: number }).port;
    try {
      await assert.rejects(
        openGameRoom(
          `ws://127.0.0.1:${port}`,
          { kind: "create", name: "Test" },
          250,
        ),
        /tidak merespons/,
      );
      if (handshake) assert.equal(upgraded, true);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});
