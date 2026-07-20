import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import {
  getRunePages,
  setCurrentRunePage,
  getRecommendedRunes,
  applyRecommendedRunes,
  APP_RUNE_PAGE_NAME,
} from "./perks";

describe("getRunePages", () => {
  it("devolve {id,name,current} das páginas", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [
          { id: 1, name: "Eletrocutar", current: true, isEditable: true },
          { id: 2, name: "Conqueror", current: false, isEditable: true },
        ],
      }),
    } as unknown as AxiosInstance;

    expect(await getRunePages(client)).toEqual([
      { id: 1, name: "Eletrocutar", current: true },
      { id: 2, name: "Conqueror", current: false },
    ]);
    expect(client.get).toHaveBeenCalledWith("/lol-perks/v1/pages");
  });
});

describe("setCurrentRunePage", () => {
  it("faz PUT na currentpage com o id e header JSON (axios recusa número puro)", async () => {
    const client = { put: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await setCurrentRunePage(client, 2);
    expect(client.put).toHaveBeenCalledWith("/lol-perks/v1/currentpage", 2, {
      headers: { "Content-Type": "application/json" },
    });
  });
});

describe("getRecommendedRunes", () => {
  it("busca no endpoint com champ/posição/mapa e mapeia keystone + perk ids", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [
          {
            primaryPerkStyleId: 8000,
            secondaryPerkStyleId: 8100,
            perks: [
              { id: 8010, name: "Conquistador" },
              { id: 9111, name: "Triunfo" },
              { id: 5008, name: "Força Adaptativa" },
            ],
          },
        ],
      }),
    } as unknown as AxiosInstance;

    const recs = await getRecommendedRunes(client, 64, "middle");
    expect(client.get).toHaveBeenCalledWith(
      "/lol-perks/v1/recommended-pages/champion/64/position/middle/map/11"
    );
    expect(recs).toEqual([
      {
        name: "Conquistador",
        primaryStyleId: 8000,
        subStyleId: 8100,
        selectedPerkIds: [8010, 9111, 5008],
      },
    ]);
  });

  it("usa 'middle' quando a posição vem vazia", async () => {
    const client = { get: vi.fn().mockResolvedValue({ data: [] }) } as unknown as AxiosInstance;
    await getRecommendedRunes(client, 64, "");
    expect(client.get).toHaveBeenCalledWith(
      "/lol-perks/v1/recommended-pages/champion/64/position/middle/map/11"
    );
  });
});

describe("applyRecommendedRunes", () => {
  it("apaga a página anterior do app e cria a nova como atual", async () => {
    const del = vi.fn().mockResolvedValue({ data: {} });
    const post = vi.fn().mockResolvedValue({ data: { isValid: true } });
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [
          { id: 111, name: APP_RUNE_PAGE_NAME },
          { id: 222, name: "Minha Vayne" },
        ],
      }),
      delete: del,
      post,
    } as unknown as AxiosInstance;

    await applyRecommendedRunes(client, {
      name: "Conquistador",
      primaryStyleId: 8000,
      subStyleId: 8100,
      selectedPerkIds: [8010, 9111, 5008],
    });

    // apaga só a página do app (id 111), não a "Minha Vayne"
    expect(del).toHaveBeenCalledWith("/lol-perks/v1/pages/111");
    expect(del).toHaveBeenCalledTimes(1);
    // cria a nova, marcada como current
    expect(post).toHaveBeenCalledWith("/lol-perks/v1/pages", {
      name: APP_RUNE_PAGE_NAME,
      primaryStyleId: 8000,
      subStyleId: 8100,
      selectedPerkIds: [8010, 9111, 5008],
      current: true,
    });
  });
});
