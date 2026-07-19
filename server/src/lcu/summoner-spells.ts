import { AxiosInstance } from "axios";

export interface SummonerSpell {
  id: number;
  name: string;
}

// A LCU serve a lista de feitiços como um asset JSON (não há um json por id).
const SPELLS_URL = "/lol-game-data/assets/v1/summoner-spells.json";

interface RawSpell {
  id: number;
  name: string;
  gameModes?: string[];
  iconPath?: string;
}

/** Feitiços utilizáveis na Summoner's Rift (mapa clássico). */
export async function getSummonerSpells(
  client: AxiosInstance
): Promise<SummonerSpell[]> {
  const { data } = await client.get(SPELLS_URL);
  return (data as RawSpell[])
    .filter(
      (s) => s.id > 0 && Array.isArray(s.gameModes) && s.gameModes.includes("CLASSIC")
    )
    .map((s) => ({ id: s.id, name: s.name }));
}

/** Acha o caminho do ícone do feitiço (na lista) para o proxy repassar. */
export async function getSpellIconPath(
  client: AxiosInstance,
  id: number
): Promise<string | null> {
  const { data } = await client.get(SPELLS_URL);
  const spell = (data as RawSpell[]).find((s) => s.id === id);
  return spell?.iconPath ?? null;
}

/** Troca os feitiços de invocador do jogador (slots D e F). */
export async function setSummonerSpells(
  client: AxiosInstance,
  spell1Id: number,
  spell2Id: number
): Promise<void> {
  await client.patch("/lol-champ-select/v1/session/my-selection", {
    spell1Id,
    spell2Id,
  });
}
