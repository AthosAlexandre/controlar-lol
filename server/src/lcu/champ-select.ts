import { AxiosInstance } from "axios";

interface ChampSelectAction {
  id: number;
  actorCellId: number;
  championId: number;
  completed: boolean;
  type: string;
}

export interface PickInfo {
  actionId: number;
  championId: number;
  completed: boolean;
}

export interface Champion {
  id: number;
  name: string;
}

/**
 * Acha a sua ação de pick na sessão de seleção, pelo localPlayerCellId.
 * Retorna null se não houver sessão válida ou ação de pick sua.
 */
export function findMyPickAction(session: unknown): PickInfo | null {
  const s = session as {
    localPlayerCellId?: number;
    actions?: ChampSelectAction[][];
  };
  if (!s || typeof s.localPlayerCellId !== "number" || !Array.isArray(s.actions)) {
    return null;
  }
  for (const group of s.actions) {
    for (const action of group) {
      if (action.actorCellId === s.localPlayerCellId && action.type === "pick") {
        return {
          actionId: action.id,
          championId: action.championId,
          completed: action.completed,
        };
      }
    }
  }
  return null;
}

export async function getSession(client: AxiosInstance): Promise<unknown> {
  const { data } = await client.get("/lol-champ-select/v1/session");
  return data;
}

/** Seleciona (hover) um campeão na sua ação de pick. */
export async function hoverChampion(
  client: AxiosInstance,
  actionId: number,
  championId: number
): Promise<void> {
  await client.patch(`/lol-champ-select/v1/session/actions/${actionId}`, {
    championId,
  });
}

/** Trava (lock in) o campeão selecionado na sua ação de pick. */
export async function lockChampion(
  client: AxiosInstance,
  actionId: number
): Promise<void> {
  await client.post(`/lol-champ-select/v1/session/actions/${actionId}/complete`);
}

export async function getOwnedChampions(
  client: AxiosInstance
): Promise<Champion[]> {
  const { data } = await client.get("/lol-champions/v1/owned-champions-minimal");
  return (data as { id: number; name: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
  }));
}
