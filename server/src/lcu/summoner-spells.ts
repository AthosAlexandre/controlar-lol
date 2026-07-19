import { AxiosInstance } from "axios";

export interface SummonerSpell {
  id: number;
  name: string;
}

/** Feitiços utilizáveis na Summoner's Rift (mapa clássico). */
export async function getSummonerSpells(
  client: AxiosInstance
): Promise<SummonerSpell[]> {
  const { data } = await client.get("/lol-game-data/v1/summoner-spells");
  return (data as { id: number; name: string; gameModes?: string[] }[])
    .filter(
      (s) => s.id > 0 && Array.isArray(s.gameModes) && s.gameModes.includes("CLASSIC")
    )
    .map((s) => ({ id: s.id, name: s.name }));
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
