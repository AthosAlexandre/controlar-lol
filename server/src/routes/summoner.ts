import { Router } from "express";
import { connectToLcu } from "../lcu/connect";

export const summonerRouter = Router();

/** Retorna o invocador atual logado no cliente do LoL. */
summonerRouter.get("/summoner", async (_req, res) => {
  const client = connectToLcu();
  if (!client) {
    return res
      .status(503)
      .json({ error: "LoL não está aberto (lockfile não encontrado)" });
  }
  try {
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
