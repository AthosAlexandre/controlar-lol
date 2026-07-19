import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import {
  getSummonerSpells,
  setSummonerSpells,
  getSpellIconPath,
} from "./summoner-spells";

const SPELLS = [
  { id: 4, name: "Flash", gameModes: ["CLASSIC", "ARAM"], iconPath: "/x/Summoner_flash.png" },
  { id: 32, name: "Marcar", gameModes: ["ARAM"], iconPath: "/x/mark.png" },
  { id: 0, name: "", gameModes: ["CLASSIC"], iconPath: "/x/none.png" },
];

describe("getSummonerSpells", () => {
  it("filtra os feitiços da Summoner's Rift (CLASSIC, id>0) e mapeia {id,name}", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: SPELLS }),
    } as unknown as AxiosInstance;

    expect(await getSummonerSpells(client)).toEqual([{ id: 4, name: "Flash" }]);
    expect(client.get).toHaveBeenCalledWith("/lol-game-data/assets/v1/summoner-spells.json");
  });
});

describe("getSpellIconPath", () => {
  it("acha o iconPath do feitiço pelo id na lista", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: SPELLS }),
    } as unknown as AxiosInstance;

    expect(await getSpellIconPath(client, 4)).toBe("/x/Summoner_flash.png");
    expect(await getSpellIconPath(client, 999)).toBeNull();
  });
});

describe("setSummonerSpells", () => {
  it("faz PATCH em my-selection com os dois feitiços", async () => {
    const client = { patch: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await setSummonerSpells(client, 4, 14);
    expect(client.patch).toHaveBeenCalledWith(
      "/lol-champ-select/v1/session/my-selection",
      { spell1Id: 4, spell2Id: 14 }
    );
  });
});
