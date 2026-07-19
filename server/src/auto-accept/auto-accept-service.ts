import { AxiosInstance } from "axios";
import { connectToLcu } from "../lcu/connect";
import { getGameflowPhase, acceptReadyCheck } from "../lcu/matchmaking";
import { shouldAccept } from "./should-accept";

/**
 * Um ciclo do auto-aceitar: conecta na LCU, lê a fase e aceita se for ReadyCheck.
 * `connect` é injetável para teste; em produção usa connectToLcu.
 */
export async function pollAndAccept(
  connect: () => AxiosInstance | null = connectToLcu
): Promise<void> {
  const client = connect();
  if (!client) return; // LoL fechado — tenta no próximo ciclo
  try {
    const phase = await getGameflowPhase(client);
    if (shouldAccept(phase)) {
      await acceptReadyCheck(client);
    }
  } catch {
    // O LoL pode ter fechado no meio do ciclo; ignora e tenta de novo depois.
  }
}

/**
 * Cria o serviço de auto-aceitar: guarda o estado ligado/desligado e roda um
 * loop que chama `check` a cada `intervalMs` enquanto estiver ligado.
 */
export function createAutoAcceptService(
  check: () => Promise<void>,
  intervalMs = 1000
) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let enabled = false;

  return {
    isEnabled: () => enabled,
    setEnabled(value: boolean) {
      enabled = value;
      if (value && !timer) {
        timer = setInterval(check, intervalMs);
      } else if (!value && timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

/** Singleton usado pela API. Começa desligado. */
export const autoAcceptService = createAutoAcceptService(() => pollAndAccept());
