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

/** Extrai o motivo real de um erro da LCU (status + corpo), que o axios esconde. */
function lcuError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: unknown }; message?: string };
  if (e?.response) {
    return `HTTP ${e.response.status} ${JSON.stringify(e.response.data)}`;
  }
  return e?.message ? String(e.message) : String(err);
}

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
    res.status(502).json({ error: "Falha ao selecionar", detail: lcuError(err) });
  }
});

/** Confirma (trava) o campeão selecionado. */
champSelectRouter.post("/champ-select/lock", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    const pick = findMyPickAction(await getSession(client));
    if (!pick) return res.status(409).json({ error: "Você não está escolhendo agora" });
    // Prioriza o campeão que o app mandou; se não veio, usa o que já está no hover.
    const championId = Number(req.body?.championId) || pick.championId;
    if (!championId) {
      return res.status(409).json({ error: "Escolha um campeão antes de confirmar" });
    }
    await lockChampion(client, pick.actionId, championId);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Não foi possível confirmar o campeão", detail: lcuError(err) });
  }
});
