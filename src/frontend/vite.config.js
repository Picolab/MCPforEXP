import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // This maps http://localhost:5173/api to http://localhost:3001/api
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      // This maps the Socket.io traffic
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
