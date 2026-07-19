// O app é servido pelo próprio servidor (porta 3000); use a mesma origem da página.
const baseUrl = window.location.origin;

export type Phase =
  | "Offline"
  | "None"
  | "Lobby"
  | "Matchmaking"
  | "ReadyCheck"
  | "ChampSelect"
  | "InProgress"
  | "Other";

export interface Summoner {
  name: string;
  tagLine: string;
  level: number;
}

export interface GameState {
  phase: Phase;
  summoner: Summoner | null;
}

/** Assina o stream de estado (SSE). Retorna uma função que encerra a conexão. */
export function subscribeEvents(onState: (state: GameState) => void): () => void {
  const es = new EventSource(`${baseUrl}/api/events`);
  es.onmessage = (e) => {
    try {
      onState(JSON.parse(e.data));
    } catch {
      // ignora payloads malformados
    }
  };
  return () => es.close();
}

export async function accept(): Promise<void> {
  const res = await fetch(`${baseUrl}/api/accept`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
}

export async function getAutoAccept(): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/auto-accept`);
  const body = await res.json();
  return Boolean(body.enabled);
}

export async function setAutoAccept(enabled: boolean): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/auto-accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const body = await res.json();
  return Boolean(body.enabled);
}

export interface Champion {
  id: number;
  name: string;
}

export interface RunePage {
  id: number;
  name: string;
  current: boolean;
}

export interface PickState {
  actionId?: number;
  championId?: number;
  completed?: boolean;
  canPick: boolean;
}

/** URL do ícone do campeão (proxy no servidor). */
export function championIconUrl(id: number): string {
  return `${baseUrl}/api/champion-icon/${id}`;
}

export async function getChampions(): Promise<Champion[]> {
  const res = await fetch(`${baseUrl}/api/champions`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function getChampSelect(): Promise<PickState> {
  const res = await fetch(`${baseUrl}/api/champ-select`);
  return res.json();
}

async function postJson(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `Erro ${res.status}`);
  }
}

export function hoverChampion(championId: number): Promise<void> {
  return postJson("/api/champ-select/hover", { championId });
}

export function lockChampion(championId: number): Promise<void> {
  return postJson("/api/champ-select/lock", { championId });
}

export async function getRunePages(): Promise<RunePage[]> {
  const res = await fetch(`${baseUrl}/api/rune-pages`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function setRunePage(id: number): Promise<void> {
  return postJson("/api/rune-pages/current", { id });
}
