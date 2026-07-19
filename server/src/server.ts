import express from "express";
import cors from "cors";
import http from "node:http";
import path from "node:path";
import { summonerRouter } from "./routes/summoner";
import { actionsRouter } from "./routes/actions";
import { eventsRouter } from "./routes/events";
import { champSelectRouter } from "./routes/champ-select";
import { runesRouter } from "./routes/runes";
import { startGameflowWatcher } from "./lcu/events";

export function createApp(opts: { webDistPath?: string } = {}): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", summonerRouter);
  app.use("/api", actionsRouter);
  app.use("/api", eventsRouter);
  app.use("/api", champSelectRouter);
  app.use("/api", runesRouter);

  // Serve o app do celular (web buildado). SPA: qualquer rota não-/api cai no index.html.
  if (opts.webDistPath) {
    const dist = opts.webDistPath;
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(dist, "index.html"));
    });
  }
  return app;
}

let server: http.Server | null = null;
let stopWatcher: (() => void) | null = null;

export function startServer(
  opts: { port?: number; webDistPath?: string } = {}
): Promise<http.Server> {
  const port = opts.port ?? 3000;
  const app = createApp({ webDistPath: opts.webDistPath });
  return new Promise((resolve, reject) => {
    const s = http.createServer(app);
    s.once("error", reject);
    // 0.0.0.0 permite acesso pelo celular na rede local.
    s.listen(port, "0.0.0.0", () => {
      server = s;
      stopWatcher = startGameflowWatcher();
      resolve(s);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (stopWatcher) {
      stopWatcher();
      stopWatcher = null;
    }
    if (!server) return resolve();
    server.close(() => {
      server = null;
      resolve();
    });
  });
}
