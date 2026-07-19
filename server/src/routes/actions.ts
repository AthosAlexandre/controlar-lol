import { Router } from "express";
import { connectToLcu } from "../lcu/connect";
import { getGameflowPhase, acceptReadyCheck } from "../lcu/matchmaking";
import { shouldAccept } from "../auto-accept/should-accept";
import { autoAcceptService } from "../auto-accept/auto-accept-service";

export const actionsRouter = Router();

/** Aceita a partida agora (ação manual do botão ACEITAR). */
actionsRouter.post("/accept", async (_req, res) => {
  const client = connectToLcu();
  if (!client) {
    return res.status(503).json({ error: "LoL não está aberto" });
  }
  try {
    const phase = await getGameflowPhase(client);
    if (!shouldAccept(phase)) {
      return res.status(409).json({ error: "Nenhuma partida para aceitar" });
    }
    await acceptReadyCheck(client);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Falha ao aceitar", detail: String(err) });
  }
});

/** Estado atual do auto-aceitar. */
actionsRouter.get("/auto-accept", (_req, res) => {
  res.json({ enabled: autoAcceptService.isEnabled() });
});

/** Liga/desliga o auto-aceitar. */
actionsRouter.post("/auto-accept", (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  autoAcceptService.setEnabled(enabled);
  res.json({ enabled: autoAcceptService.isEnabled() });
});
