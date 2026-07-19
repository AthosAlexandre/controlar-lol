import { describe, it, expect } from "vitest";
import { parsePhaseFromMessage } from "./events";

describe("parsePhaseFromMessage", () => {
  it("extrai a fase de um evento gameflow-phase da LCU", () => {
    const msg = JSON.stringify([
      8,
      "OnJsonApiEvent_lol-gameflow_v1_gameflow-phase",
      { data: "Matchmaking", eventType: "Update", uri: "/lol-gameflow/v1/gameflow-phase" },
    ]);
    expect(parsePhaseFromMessage(msg)).toBe("Matchmaking");
  });

  it("retorna null para mensagens sem data de fase", () => {
    expect(parsePhaseFromMessage(JSON.stringify([8, "Outro", {}]))).toBeNull();
  });

  it("retorna null para mensagens que não são JSON", () => {
    expect(parsePhaseFromMessage("nao-e-json")).toBeNull();
  });
});
