import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { getOwnedSkins, selectSkin } from "./skins";

describe("getOwnedSkins", () => {
  it("devolve só as skins que o jogador possui e não estão desabilitadas", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [
          { id: 64000, name: "Lee Sin", ownership: { owned: true }, disabled: false },
          { id: 64001, name: "Lee Sin Aço", ownership: { owned: false }, disabled: false },
          { id: 64002, name: "Lee Sin Dragão", ownership: { owned: true }, disabled: true },
          { id: 64010, name: "Lee Sin God Fist", ownership: { owned: true }, disabled: false },
        ],
      }),
    } as unknown as AxiosInstance;

    expect(await getOwnedSkins(client)).toEqual([
      { id: 64000, name: "Lee Sin" },
      { id: 64010, name: "Lee Sin God Fist" },
    ]);
    expect(client.get).toHaveBeenCalledWith("/lol-champ-select/v1/skin-carousel-skins");
  });
});

describe("selectSkin", () => {
  it("faz PATCH em my-selection com o selectedSkinId", async () => {
    const client = { patch: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await selectSkin(client, 64010);
    expect(client.patch).toHaveBeenCalledWith("/lol-champ-select/v1/session/my-selection", {
      selectedSkinId: 64010,
    });
  });
});
