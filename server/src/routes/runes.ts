import { Router } from "express";
import { connectToLcu } from "../lcu/connect";
import { getRunePages, setCurrentRunePage } from "../lcu/perks";

export const runesRouter = Router();

/** Páginas de runas salvas do jogador. */
runesRouter.get("/rune-pages", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    res.json(await getRunePages(client));
  } catch (err) {
    res.status(502).json({ error: "Falha ao listar runas", detail: String(err) });
  }
});

/** Aplica (deixa ativa) uma página de runas. */
runesRouter.post("/rune-pages/current", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    await setCurrentRunePage(client, Number(req.body?.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Falha ao aplicar runa", detail: String(err) });
  }
});
