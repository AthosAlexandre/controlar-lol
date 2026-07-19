import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import {
  findMyPickAction,
  getSession,
  hoverChampion,
  lockChampion,
  getOwnedChampions,
  summarizeChampSelect,
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

const fullSession = {
  localPlayerCellId: 0,
  actions: [
    [{ id: 0, actorCellId: 0, championId: 0, completed: false, type: "pick" }],
  ],
  myTeam: [
    { cellId: 0, championId: 0, championPickIntent: 64, assignedPosition: "top", spell1Id: 4, spell2Id: 6 },
    { cellId: 1, championId: 103, championPickIntent: 0, assignedPosition: "jungle", spell1Id: 4, spell2Id: 11 },
  ],
  theirTeam: [
    { cellId: 5, championId: 157, championPickIntent: 99, assignedPosition: "middle" },
    { cellId: 6, championId: 0, championPickIntent: 0, assignedPosition: "" },
  ],
};

describe("summarizeChampSelect", () => {
  it("usa o hover (pickIntent) no meu time e só o champ visível no inimigo", () => {
    const s = summarizeChampSelect(fullSession);
    expect(s.myTeam[0]).toEqual({ cellId: 0, championId: 64, position: "top" });
    expect(s.myTeam[1]).toEqual({ cellId: 1, championId: 103, position: "jungle" });
    // inimigo: NÃO usa pickIntent (Riot esconde o hover)
    expect(s.theirTeam[0]).toEqual({ cellId: 5, championId: 157, position: "middle" });
    expect(s.theirTeam[1]).toEqual({ cellId: 6, championId: 0, position: "" });
  });

  it("pega meus feitiços pelo localPlayerCellId e mantém o estado de pick", () => {
    const s = summarizeChampSelect(fullSession);
    expect(s.mySpells).toEqual({ spell1Id: 4, spell2Id: 6 });
    expect(s.canPick).toBe(true);
    expect(s.actionId).toBe(0);
  });

  it("sessão vazia → times vazios, sem feitiços, canPick false", () => {
    const s = summarizeChampSelect(null);
    expect(s).toEqual({
      canPick: false,
      actionId: 0,
      championId: 0,
      completed: false,
      myTeam: [],
      theirTeam: [],
      mySpells: null,
    });
  });
});
