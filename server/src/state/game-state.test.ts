import { describe, it, expect, vi } from "vitest";
import { createGameState } from "./game-state";

describe("createGameState", () => {
  it("começa Offline sem summoner", () => {
    const gs = createGameState();
    expect(gs.getState()).toEqual({ phase: "Offline", summoner: null });
  });

  it("emite quando a fase muda, mas não quando repete", () => {
    const gs = createGameState();
    const cb = vi.fn();
    gs.subscribe(cb);

    gs.setPhase("Matchmaking");
    gs.setPhase("Matchmaking"); // repetida — não emite
    gs.setPhase("ReadyCheck");

    expect(cb).toHaveBeenCalledTimes(2);
    expect(gs.getState().phase).toBe("ReadyCheck");
  });

  it("emite quando o summoner muda, e não quando é igual", () => {
    const gs = createGameState();
    const cb = vi.fn();
    gs.subscribe(cb);

    gs.setSummoner({ name: "SOHTA", tagLine: "BR1", level: 664 });
    gs.setSummoner({ name: "SOHTA", tagLine: "BR1", level: 664 }); // igual — não emite

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("subscribe retorna uma função que desinscreve", () => {
    const gs = createGameState();
    const cb = vi.fn();
    const unsub = gs.subscribe(cb);

    gs.setPhase("Lobby");
    unsub();
    gs.setPhase("Matchmaking");

    expect(cb).toHaveBeenCalledTimes(1);
  });
});
