import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { getRunePages, setCurrentRunePage } from "./perks";

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
