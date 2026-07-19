import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { sseData, eventsHandler } from "./events";
import { gameState } from "../state/game-state";

describe("sseData", () => {
  it("formata o estado como evento SSE", () => {
    const out = sseData({ phase: "Matchmaking", summoner: null });
    expect(out).toBe('data: {"phase":"Matchmaking","summoner":null}\n\n');
  });
});

describe("eventsHandler", () => {
  it("manda o estado atual, empurra mudanças e para ao fechar", () => {
    // req falso (EventEmitter para o evento 'close'); res falso captura writes
    const req = new EventEmitter() as any;
    const writes: string[] = [];
    const res: any = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: (chunk: string) => writes.push(chunk),
    };

    gameState.setPhase("None");
    eventsHandler(req, res);
    expect(writes[0]).toContain('"phase":"None"');

    gameState.setPhase("Matchmaking");
    expect(writes[1]).toContain('"phase":"Matchmaking"');

    req.emit("close"); // celular desconectou
    gameState.setPhase("ChampSelect");
    expect(writes).toHaveLength(2); // não escreveu mais após o close
  });
});
