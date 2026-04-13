import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd() + "/../../", "VITE_");
  const target = env.VITE_API_URL || "http://localhost:3001";

  return {
    plugins: [react()],
    server: {
      port: 3005, // Moves UI to 3005 to avoid the Pico-Engine on 3000
      host: true, // Exposes the server to the public EC2 IP
      strictPort: true, // Prevents Vite from accidentally picking a different port
      allowedHosts: ["manny.picolabs.io", "engine.picolabs.io"],
      proxy: {
        // Keep your existing proxy settings for local communication on the server
        "/api": {
          target: target,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: target,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
