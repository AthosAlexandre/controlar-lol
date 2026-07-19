// O app foi carregado pelo IP/host do PC; o servidor é o mesmo host na porta 3000.
const baseUrl = `http://${window.location.hostname}:3000`;

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
