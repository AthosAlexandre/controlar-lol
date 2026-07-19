import express from "express";
import cors from "cors";
import { readLockfile } from "./lcu/lockfile-reader";
import { summonerRouter } from "./routes/summoner";
import { actionsRouter } from "./routes/actions";

const PORT = 3000;

const app = express();
app.use(cors()); // rede local confiável no MVP; libera o app (5173) a chamar a API
app.use(express.json());
app.use("/api", summonerRouter);
app.use("/api", actionsRouter);

// 0.0.0.0 permite acesso pelo celular na rede local (não só localhost).
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  const lockfile = readLockfile();
  if (lockfile) {
    // Nunca logar o token inteiro.
    console.log(
      `LoL detectado! Porta: ${lockfile.port} | Token: ${lockfile.token.slice(0, 6)}…`
    );
  } else {
    console.log("LoL ainda não detectado (abra o cliente).");
  }
});
