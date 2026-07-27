import { AxiosInstance } from "axios";

export interface Skin {
  id: number;
  name: string;
}

interface RawSkin {
  id: number;
  name: string;
  ownership?: { owned?: boolean };
  disabled?: boolean;
}

/** Skins que o jogador possui do campeão escolhido (carrossel da seleção). */
export async function getOwnedSkins(client: AxiosInstance): Promise<Skin[]> {
  const { data } = await client.get("/lol-champ-select/v1/skin-carousel-skins");
  return (data as RawSkin[])
    .filter((s) => s.ownership?.owned && !s.disabled)
    .map((s) => ({ id: s.id, name: s.name }));
}

/** Troca a skin selecionada do campeão. */
export async function selectSkin(client: AxiosInstance, skinId: number): Promise<void> {
  await client.patch("/lol-champ-select/v1/session/my-selection", { selectedSkinId: skinId });
}
