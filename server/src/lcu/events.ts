import WebSocket from "ws";
import { Agent } from "node:https";
import { readLockfile } from "./lockfile-reader";
import { buildCredentials } from "./credentials";
import { connectToLcu } from "./connect";
import { getGameflowPhase } from "./matchmaking";
import { gameState } from "../state/game-state";
import { normalizePhase } from "../state/normalize-phase";

const RECONNECT_MS = 3000;
const GAMEFLOW_EVENT = "OnJsonApiEvent_lol-gameflow_v1_gameflow-phase";

/**
 * Extrai a fase de uma mensagem do WebSocket da LCU.
 * As mensagens de evento têm o formato [8, topic, { data, eventType, uri }].
 */
export function parsePhaseFromMessage(raw: string): string | null {
  try {
    const msg = JSON.parse(raw);
    if (Array.isArray(msg) && msg[2] && typeof msg[2].data === "string") {
      return msg[2].data;
    }
  } catch {
    // heartbeats e mensagens não-JSON são ignorados
  }
  return null;
}

/**
 * Abre o WebSocket da LCU e mantém o game-state atualizado com a fase do jogo.
 * Reconecta sozinho (relendo o lockfile) quando o LoL fecha ou o WS cai.
 */
export function startGameflowWatcher(): () => void {
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function scheduleReconnect() {
    if (stopped) return;
    gameState.setPhase("Offline");
    gameState.setSummoner(null);
    timer = setTimeout(connect, RECONNECT_MS);
  }

  async function primeInitialState() {
    // Estado inicial via REST: a fase atual e o nick, para não esperar a próxima mudança.
    try {
      const client = connectToLcu();
      if (!client) return;
      const phase = await getGameflowPhase(client);
      gameState.setPhase(normalizePhase(phase));
      const { data } = await client.get("/lol-summoner/v1/current-summoner");
      gameState.setSummoner({
        name: data.gameName || data.displayName,
        tagLine: data.tagLine,
        level: data.summonerLevel,
      });
    } catch {
      // se falhar, o estado vem pelos eventos do WS
    }
  }

  function connect() {
    if (stopped) return;
    const lockfile = readLockfile();
    if (!lockfile) {
      scheduleReconnect();
      return;
    }
    const creds = buildCredentials(lockfile);
    ws = new WebSocket(creds.baseUrl.replace("https", "wss"), {
      agent: new Agent({ rejectUnauthorized: false }),
      headers: { Authorization: creds.authHeader },
    });

    ws.on("open", () => {
      // Assina só o evento de mudança de fase (não o firehose inteiro).
      ws?.send(JSON.stringify([5, GAMEFLOW_EVENT]));
      void primeInitialState();
    });
    ws.on("message", (raw: WebSocket.RawData) => {
      const phase = parsePhaseFromMessage(raw.toString());
      if (phase) gameState.setPhase(normalizePhase(phase));
    });
    ws.on("close", scheduleReconnect);
    ws.on("error", () => ws?.close()); // 'close' agenda a reconexão
  }

  connect();

  // Para as reconexões e fecha o WebSocket (usado pelo stopServer).
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (ws) ws.close();
  };
}
