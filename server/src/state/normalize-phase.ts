/** Fase do jogo já normalizada para um conjunto fechado. */
export type Phase =
  | "Offline"
  | "None"
  | "Lobby"
  | "Matchmaking"
  | "ReadyCheck"
  | "ChampSelect"
  | "InProgress"
  | "Other";

const DIRECT = ["None", "Lobby", "Matchmaking", "ReadyCheck", "ChampSelect"];
const IN_PROGRESS = new Set([
  "GameStart",
  "InProgress",
  "Reconnect",
  "WaitingForStats",
  "PreEndOfGame",
]);

/**
 * Mapeia a string crua de gameflow-phase da LCU para o tipo Phase.
 * "Offline" é sintético (definido pelo watcher) e nunca sai daqui.
 */
export function normalizePhase(raw: string): Phase {
  if (DIRECT.includes(raw)) return raw as Phase;
  if (IN_PROGRESS.has(raw)) return "InProgress";
  return "Other";
}
