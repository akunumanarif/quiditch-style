import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "0.0.0.0",
    proxy: {
      "/matchmake": { target: "http://localhost:2567" },
      "/realtime": {
        target: "ws://localhost:2567",
        ws: true,
        rewrite: (p) => p.replace(/^\/realtime/, ""),
      },
    },
  },
  build: { target: "es2022", chunkSizeWarningLimit: 2500 },
});
