import express from "express";
import cors from "cors";
import { readLockfile } from "./lcu/lockfile-reader";
import { summonerRouter } from "./routes/summoner";
import { actionsRouter } from "./routes/actions";
import { eventsRouter } from "./routes/events";
import { champSelectRouter } from "./routes/champ-select";
import { runesRouter } from "./routes/runes";
import { startGameflowWatcher } from "./lcu/events";

const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", summonerRouter);
app.use("/api", actionsRouter);
app.use("/api", eventsRouter);
app.use("/api", champSelectRouter);
app.use("/api", runesRouter);

// 0.0.0.0 permite acesso pelo celular na rede local (não só localhost).
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  const lockfile = readLockfile();
  if (lockfile) {
    console.log(
      `LoL detectado! Porta: ${lockfile.port} | Token: ${lockfile.token.slice(0, 6)}…`
    );
  } else {
    console.log("LoL ainda não detectado (abra o cliente).");
  }
  // Começa a ouvir os eventos de fase da LCU e a alimentar o game-state.
  startGameflowWatcher();
});
