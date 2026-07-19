import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { getSummonerSpells, setSummonerSpells } from "./summoner-spells";

describe("getSummonerSpells", () => {
  it("filtra os feitiços da Summoner's Rift (CLASSIC, id>0) e mapeia {id,name}", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [
          { id: 4, name: "Flash", gameModes: ["CLASSIC", "ARAM"] },
          { id: 32, name: "Marcar", gameModes: ["ARAM"] },
          { id: 0, name: "", gameModes: ["CLASSIC"] },
        ],
      }),
    } as unknown as AxiosInstance;

    expect(await getSummonerSpells(client)).toEqual([{ id: 4, name: "Flash" }]);
    expect(client.get).toHaveBeenCalledWith("/lol-game-data/v1/summoner-spells");
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
