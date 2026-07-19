import { Router } from "express";
import { connectToLcu } from "../lcu/connect";
import {
  getSession,
  findMyPickAction,
  findMyBanAction,
  hoverChampion,
  lockChampion,
  getOwnedChampions,
  summarizeChampSelect,
} from "../lcu/champ-select";
import {
  getSummonerSpells,
  setSummonerSpells,
  getSpellIconPath,
} from "../lcu/summoner-spells";

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

/** Estado da seleção: pick + times + feitiços + ban (ou vazio fora dela). */
champSelectRouter.get("/champ-select", async (_req, res) => {
  const empty = {
    canPick: false,
    myTeam: [],
    theirTeam: [],
    mySpells: null,
    ban: null,
    isBanPhase: false,
  };
  const client = connectToLcu();
  if (!client) return res.json(empty);
  try {
    res.json(summarizeChampSelect(await getSession(client)));
  } catch {
    res.json(empty);
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

/** Seleciona (hover) um campeão para banir. */
champSelectRouter.post("/champ-select/ban-hover", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    const ban = findMyBanAction(await getSession(client));
    if (!ban) return res.status(409).json({ error: "Não é hora de banir" });
    await hoverChampion(client, ban.actionId, Number(req.body?.championId));
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Falha ao selecionar o ban", detail: lcuError(err) });
  }
});

/** Bane (trava) o campeão selecionado. */
champSelectRouter.post("/champ-select/ban", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    const ban = findMyBanAction(await getSession(client));
    if (!ban) return res.status(409).json({ error: "Não é hora de banir" });
    const championId = Number(req.body?.championId) || ban.championId;
    if (!championId) {
      return res.status(409).json({ error: "Escolha um campeão para banir" });
    }
    await lockChampion(client, ban.actionId, championId);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Não foi possível banir", detail: lcuError(err) });
  }
});

/** Feitiços de invocador disponíveis (Summoner's Rift). */
champSelectRouter.get("/summoner-spells", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    res.json(await getSummonerSpells(client));
  } catch (err) {
    res.status(502).json({ error: "Falha ao listar feitiços", detail: lcuError(err) });
  }
});

/** Proxy do ícone do feitiço (acha o iconPath na lista e repassa o PNG). */
champSelectRouter.get("/spell-icon/:id", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).end();
  try {
    const iconPath = await getSpellIconPath(client, Number(req.params.id));
    if (!iconPath) return res.status(404).end();
    const { data } = await client.get(iconPath, { responseType: "arraybuffer" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(Buffer.from(data as ArrayBuffer));
  } catch {
    res.status(404).end();
  }
});

/** Troca os feitiços de invocador (slots D e F). */
champSelectRouter.post("/champ-select/spells", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    await setSummonerSpells(
      client,
      Number(req.body?.spell1Id),
      Number(req.body?.spell2Id)
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Não foi possível trocar o feitiço", detail: lcuError(err) });
  }
});
