import { Router, Request, Response } from "express";
import { gameState, GameState } from "../state/game-state";

/** Formata um estado de jogo como um evento SSE. */
export function sseData(state: GameState): string {
  return `data: ${JSON.stringify(state)}\n\n`;
}

/** Handler SSE: manda o estado atual e depois cada mudança. */
export function eventsHandler(req: Request, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // estado atual imediatamente
  res.write(sseData(gameState.getState()));

  const unsubscribe = gameState.subscribe((state) => {
    res.write(sseData(state));
  });

  req.on("close", unsubscribe);
}

export const eventsRouter = Router();
eventsRouter.get("/events", eventsHandler);
