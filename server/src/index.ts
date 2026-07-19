import path from "node:path";
import { startServer } from "./server";
import { readLockfile } from "./lcu/lockfile-reader";

const PORT = 3000;
// Em dev, o web pode não estar buildado; se existir, é servido também.
const webDist = path.resolve(__dirname, "../../web/dist");

startServer({ port: PORT, webDistPath: webDist }).then(() => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  const lockfile = readLockfile();
  if (lockfile) {
    console.log(
      `LoL detectado! Porta: ${lockfile.port} | Token: ${lockfile.token.slice(0, 6)}…`
    );
  } else {
    console.log("LoL ainda não detectado (abra o cliente).");
  }
});
