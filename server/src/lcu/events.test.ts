import { describe, it, test, expect, vi } from "vitest";
import { parsePhaseFromMessage, startGameflowWatcher } from "./events";

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

test("startGameflowWatcher retorna um stopper que não relança reconexão", () => {
  vi.useFakeTimers();
  // Sem LoL aberto, connect() cai em scheduleReconnect (setTimeout).
  const stop = startGameflowWatcher();
  expect(typeof stop).toBe("function");
  stop();
  // Avança o tempo: nenhuma reconexão deve ser agendada depois do stop.
  const pending = vi.getTimerCount();
  vi.advanceTimersByTime(10000);
  expect(vi.getTimerCount()).toBeLessThanOrEqual(pending);
  vi.useRealTimers();
});
