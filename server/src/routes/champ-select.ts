import { Router } from "express";
import { connectToLcu } from "../lcu/connect";
import {
  getSession,
  findMyPickAction,
  hoverChampion,
  lockChampion,
  getOwnedChampions,
} from "../lcu/champ-select";

export const champSelectRouter = Router();

/** Campeões que o jogador possui. */
champSelectRouter.get("/champions", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    res.json(await getOwnedChampions(client));
  } catch (err) {
    res.status(502).json({ error: "Falha ao listar campeões", detail: String(err) });
  }
});

/** Proxy do ícone do campeão (busca na LCU, repassa o PNG). */
champSelectRouter.get("/champion-icon/:id", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).end();
  try {
    const { data } = await client.get(
      `/lol-game-data/assets/v1/champion-icons/${req.params.id}.png`,
      { responseType: "arraybuffer" }
    );
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(Buffer.from(data as ArrayBuffer));
  } catch {
    res.status(404).end();
  }
});

/** Estado do seu pick na seleção (ou canPick:false fora dela). */
champSelectRouter.get("/champ-select", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.json({ canPick: false });
  try {
    const pick = findMyPickAction(await getSession(client));
    if (!pick) return res.json({ canPick: false });
    res.json({ ...pick, canPick: !pick.completed });
  } catch {
    res.json({ canPick: false });
  }
});

/** Seleciona (hover) um campeão. */
champSelectRouter.post("/champ-select/hover", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    const pick = findMyPickAction(await getSession(client));
    if (!pick) return res.status(409).json({ error: "Você não está escolhendo agora" });
    await hoverChampion(client, pick.actionId, Number(req.body?.championId));
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Falha ao selecionar", detail: String(err) });
  }
});

/** Trava o campeão selecionado. */
champSelectRouter.post("/champ-select/lock", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    const pick = findMyPickAction(await getSession(client));
    if (!pick) return res.status(409).json({ error: "Você não está escolhendo agora" });
    await lockChampion(client, pick.actionId);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Ainda não é sua vez de escolher", detail: String(err) });
  }
});
