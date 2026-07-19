import { Router } from "express";
import { readLockfile } from "../lcu/lockfile-reader";
import { buildCredentials } from "../lcu/credentials";
import { createLcuClient } from "../lcu/client";

export const summonerRouter = Router();

/** Retorna o invocador atual logado no cliente do LoL. */
summonerRouter.get("/summoner", async (_req, res) => {
  const lockfile = readLockfile();
  if (!lockfile) {
    return res
      .status(503)
      .json({ error: "LoL não está aberto (lockfile não encontrado)" });
  }
  try {
    const client = createLcuClient(buildCredentials(lockfile));
    const { data } = await client.get("/lol-summoner/v1/current-summoner");
    res.json({
      name: data.gameName || data.displayName,
      tagLine: data.tagLine,
      level: data.summonerLevel,
    });
  } catch (err) {
    res
      .status(502)
      .json({ error: "Falha ao falar com a LCU", detail: String(err) });
  }
});
