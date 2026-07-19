import { describe, it, expect } from "vitest";
import { shouldAccept } from "./should-accept";

describe("shouldAccept", () => {
  it("aceita quando a fase é ReadyCheck", () => {
    expect(shouldAccept("ReadyCheck")).toBe(true);
  });

  it("não aceita em outras fases", () => {
    for (const phase of ["None", "Lobby", "Matchmaking", "ChampSelect", "InProgress"]) {
      expect(shouldAccept(phase)).toBe(false);
    }
  });
});
