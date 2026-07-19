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

/**
 * Trava (lock in) o campeão na sua ação de pick, de forma atômica:
 * um único PATCH que define o campeão E marca completed. Mais confiável que o
 * POST .../complete, que só funciona se o campeão já tiver "colado" no servidor.
 */
export async function lockChampion(
  client: AxiosInstance,
  actionId: number,
  championId: number
): Promise<void> {
  await client.patch(`/lol-champ-select/v1/session/actions/${actionId}`, {
    championId,
    completed: true,
  });
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

export interface TeamMember {
  cellId: number;
  championId: number;
  position: string;
}

export interface MySpells {
  spell1Id: number;
  spell2Id: number;
}

export interface ChampSelectSummary {
  canPick: boolean;
  actionId: number;
  championId: number;
  completed: boolean;
  myTeam: TeamMember[];
  theirTeam: TeamMember[];
  mySpells: MySpells | null;
}

interface RawMember {
  cellId: number;
  championId: number;
  championPickIntent: number;
  assignedPosition: string;
  spell1Id: number;
  spell2Id: number;
}

/**
 * Resume a sessão de seleção para o app: estado do pick + os dois times + os
 * meus feitiços. No meu time mostra o hover (championPickIntent); no inimigo,
 * só o campeão visível (a Riot esconde o hover deles no draft).
 */
export function summarizeChampSelect(session: unknown): ChampSelectSummary {
  const pick = findMyPickAction(session);
  const s = session as {
    localPlayerCellId?: number;
    myTeam?: RawMember[];
    theirTeam?: RawMember[];
  };
  const localCell = typeof s?.localPlayerCellId === "number" ? s.localPlayerCellId : -1;

  const myTeam: TeamMember[] = Array.isArray(s?.myTeam)
    ? s.myTeam.map((m) => ({
        cellId: m.cellId,
        championId: m.championId || m.championPickIntent || 0,
        position: m.assignedPosition || "",
      }))
    : [];

  const theirTeam: TeamMember[] = Array.isArray(s?.theirTeam)
    ? s.theirTeam.map((m) => ({
        cellId: m.cellId,
        championId: m.championId || 0,
        position: m.assignedPosition || "",
      }))
    : [];

  const me = Array.isArray(s?.myTeam)
    ? s.myTeam.find((m) => m.cellId === localCell)
    : undefined;
  const mySpells: MySpells | null = me
    ? { spell1Id: me.spell1Id, spell2Id: me.spell2Id }
    : null;

  return {
    canPick: pick ? !pick.completed : false,
    actionId: pick?.actionId ?? 0,
    championId: pick?.championId ?? 0,
    completed: pick?.completed ?? false,
    myTeam,
    theirTeam,
    mySpells,
  };
}
