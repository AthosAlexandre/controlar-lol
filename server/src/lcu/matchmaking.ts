import { AxiosInstance } from "axios";

/**
 * Lê a fase atual do fluxo de jogo da LCU.
 * Retorna uma string como "None", "Lobby", "Matchmaking", "ReadyCheck",
 * "ChampSelect", "InProgress".
 */
export async function getGameflowPhase(client: AxiosInstance): Promise<string> {
  const { data } = await client.get("/lol-gameflow/v1/gameflow-phase");
  return data;
}

/** Aceita a partida encontrada (ready-check). */
export async function acceptReadyCheck(client: AxiosInstance): Promise<void> {
  await client.post("/lol-matchmaking/v1/ready-check/accept");
}
