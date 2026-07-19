import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// server.host = true faz o Vite ouvir em 0.0.0.0 (celular acessa por IP-do-PC:5173).
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
