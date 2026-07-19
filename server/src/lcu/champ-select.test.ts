import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import {
  findMyPickAction,
  getSession,
  hoverChampion,
  lockChampion,
  getOwnedChampions,
} from "./champ-select";

const session = {
  localPlayerCellId: 2,
  actions: [
    [{ id: 10, actorCellId: 1, championId: 0, completed: false, type: "pick" }],
    [{ id: 11, actorCellId: 2, championId: 64, completed: false, type: "pick" }],
  ],
};

describe("findMyPickAction", () => {
  it("acha a ação de pick do meu cell", () => {
    expect(findMyPickAction(session)).toEqual({
      actionId: 11,
      championId: 64,
      completed: false,
    });
  });

  it("retorna null quando não há sessão válida", () => {
    expect(findMyPickAction(null)).toBeNull();
    expect(findMyPickAction({})).toBeNull();
    expect(findMyPickAction({ localPlayerCellId: 9, actions: [] })).toBeNull();
  });
});

describe("wrappers da LCU", () => {
  it("getSession faz GET na sessão de champ-select", async () => {
    const client = { get: vi.fn().mockResolvedValue({ data: session }) } as unknown as AxiosInstance;
    expect(await getSession(client)).toEqual(session);
    expect(client.get).toHaveBeenCalledWith("/lol-champ-select/v1/session");
  });

  it("hoverChampion faz PATCH na ação com o championId", async () => {
    const client = { patch: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await hoverChampion(client, 11, 64);
    expect(client.patch).toHaveBeenCalledWith(
      "/lol-champ-select/v1/session/actions/11",
      { championId: 64 }
    );
  });

  it("lockChampion faz PATCH atômico (championId + completed:true)", async () => {
    const client = { patch: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await lockChampion(client, 11, 64);
    expect(client.patch).toHaveBeenCalledWith(
      "/lol-champ-select/v1/session/actions/11",
      { championId: 64, completed: true }
    );
  });

  it("getOwnedChampions devolve {id,name}", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [{ id: 64, name: "Lee Sin", alias: "LeeSin" }],
      }),
    } as unknown as AxiosInstance;
    expect(await getOwnedChampions(client)).toEqual([{ id: 64, name: "Lee Sin" }]);
    expect(client.get).toHaveBeenCalledWith("/lol-champions/v1/owned-champions-minimal");
  });
});
