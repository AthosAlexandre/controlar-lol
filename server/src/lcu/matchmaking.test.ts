import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { getGameflowPhase, acceptReadyCheck } from "./matchmaking";

describe("getGameflowPhase", () => {
  it("faz GET no endpoint de gameflow-phase e devolve a string da fase", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: "ReadyCheck" }),
    } as unknown as AxiosInstance;

    const phase = await getGameflowPhase(client);

    expect(client.get).toHaveBeenCalledWith("/lol-gameflow/v1/gameflow-phase");
    expect(phase).toBe("ReadyCheck");
  });
});

describe("acceptReadyCheck", () => {
  it("faz POST no endpoint de aceitar a partida", async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ data: {} }),
    } as unknown as AxiosInstance;

    await acceptReadyCheck(client);

    expect(client.post).toHaveBeenCalledWith(
      "/lol-matchmaking/v1/ready-check/accept"
    );
  });
});
