import { AxiosInstance } from "axios";

export interface RunePage {
  id: number;
  name: string;
  current: boolean;
}

export async function getRunePages(client: AxiosInstance): Promise<RunePage[]> {
  const { data } = await client.get("/lol-perks/v1/pages");
  return (data as { id: number; name: string; current: boolean }[]).map((p) => ({
    id: p.id,
    name: p.name,
    current: p.current,
  }));
}

/**
 * Deixa a página de runas com esse id como a página ativa.
 * O corpo é o id (número); precisa do header JSON explícito, senão o axios
 * recusa serializar um número solto ("Data after transformation must be a string…").
 */
export async function setCurrentRunePage(
  client: AxiosInstance,
  id: number
): Promise<void> {
  await client.put("/lol-perks/v1/currentpage", id, {
    headers: { "Content-Type": "application/json" },
  });
}

export interface RecommendedRunes {
  name: string;
  primaryStyleId: number;
  subStyleId: number;
  selectedPerkIds: number[];
}

/** Nome fixo da página que o app cria/reaproveita ao aplicar uma recomendada. */
export const APP_RUNE_PAGE_NAME = "Recomendada 🎯";

interface RawRecommended {
  primaryPerkStyleId: number;
  secondaryPerkStyleId: number;
  perks: { id: number; name?: string }[];
}

/**
 * Runas recomendadas do LoL para um campeão/posição (mapa 11 = Summoner's Rift).
 * O nome de exibição vem da pedra angular (primeiro perk da lista).
 */
export async function getRecommendedRunes(
  client: AxiosInstance,
  championId: number,
  position: string,
  mapId = 11
): Promise<RecommendedRunes[]> {
  const pos = position || "middle";
  const { data } = await client.get(
    `/lol-perks/v1/recommended-pages/champion/${championId}/position/${pos}/map/${mapId}`
  );
  return (data as RawRecommended[]).map((r) => ({
    name: r.perks?.[0]?.name || "Recomendada",
    primaryStyleId: r.primaryPerkStyleId,
    subStyleId: r.secondaryPerkStyleId,
    selectedPerkIds: r.perks.map((p) => p.id),
  }));
}

/**
 * Aplica uma página de runas recomendada: apaga a página anterior criada pelo app
 * (para não acumular) e cria a nova já como página ativa.
 */
export async function applyRecommendedRunes(
  client: AxiosInstance,
  runes: RecommendedRunes
): Promise<void> {
  const pages = (await client.get("/lol-perks/v1/pages")).data as {
    id: number;
    name: string;
  }[];
  for (const p of pages) {
    if (p.name === APP_RUNE_PAGE_NAME) {
      await client.delete(`/lol-perks/v1/pages/${p.id}`);
    }
  }
  await client.post("/lol-perks/v1/pages", {
    name: APP_RUNE_PAGE_NAME,
    primaryStyleId: runes.primaryStyleId,
    subStyleId: runes.subStyleId,
    selectedPerkIds: runes.selectedPerkIds,
    current: true,
  });
}
