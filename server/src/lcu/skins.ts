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
  tilePath?: string;
}

const SKIN_CAROUSEL_URL = "/lol-champ-select/v1/skin-carousel-skins";

/** Skins que o jogador possui do campeão escolhido (carrossel da seleção). */
export async function getOwnedSkins(client: AxiosInstance): Promise<Skin[]> {
  const { data } = await client.get(SKIN_CAROUSEL_URL);
  return (data as RawSkin[])
    .filter((s) => s.ownership?.owned && !s.disabled)
    .map((s) => ({ id: s.id, name: s.name }));
}

/**
 * Caminho da miniatura (tilePath) da skin, para o proxy repassar.
 * O carrossel já traz o tilePath de cada skin (ex.: .../ashe_splash_tile_0.jpg).
 */
export async function getSkinTilePath(
  client: AxiosInstance,
  skinId: number
): Promise<string | null> {
  const { data } = await client.get(SKIN_CAROUSEL_URL);
  const skin = (data as RawSkin[]).find((s) => s.id === skinId);
  return skin?.tilePath ?? null;
}

/** Troca a skin selecionada do campeão. */
export async function selectSkin(client: AxiosInstance, skinId: number): Promise<void> {
  await client.patch("/lol-champ-select/v1/session/my-selection", { selectedSkinId: skinId });
}
