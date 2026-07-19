import { describe, it, expect } from "vitest";
import { normalizePhase } from "./normalize-phase";

describe("normalizePhase", () => {
  it("mantém as fases conhecidas", () => {
    for (const p of ["None", "Lobby", "Matchmaking", "ReadyCheck", "ChampSelect"]) {
      expect(normalizePhase(p)).toBe(p);
    }
  });

  it("agrupa as fases de jogo em InProgress", () => {
    for (const p of ["GameStart", "InProgress", "Reconnect", "WaitingForStats", "PreEndOfGame"]) {
      expect(normalizePhase(p)).toBe("InProgress");
    }
  });

  it("manda fases desconhecidas para Other", () => {
    expect(normalizePhase("EndOfGame")).toBe("Other");
    expect(normalizePhase("TerminatedInError")).toBe("Other");
    expect(normalizePhase("")).toBe("Other");
  });
});
