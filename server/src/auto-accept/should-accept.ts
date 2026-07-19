/**
 * Decide se o servidor deve aceitar a partida, dada a fase do jogo.
 * Só aceita quando há um ready-check pendente.
 */
export function shouldAccept(phase: string): boolean {
  return phase === "ReadyCheck";
}
