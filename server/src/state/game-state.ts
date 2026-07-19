import { Phase } from "./normalize-phase";

export interface Summoner {
  name: string;
  tagLine: string;
  level: number;
}

export interface GameState {
  phase: Phase;
  summoner: Summoner | null;
}

type Listener = (state: GameState) => void;

function sameSummoner(a: Summoner | null, b: Summoner | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.name === b.name && a.tagLine === b.tagLine && a.level === b.level;
}

/** Cria um estado de jogo que notifica os inscritos só quando algo muda. */
export function createGameState() {
  let state: GameState = { phase: "Offline", summoner: null };
  const listeners = new Set<Listener>();

  const emit = () => {
    for (const l of listeners) l(state);
  };

  return {
    getState: (): GameState => state,
    setPhase(phase: Phase) {
      if (state.phase === phase) return;
      state = { ...state, phase };
      emit();
    },
    setSummoner(summoner: Summoner | null) {
      if (sameSummoner(state.summoner, summoner)) return;
      state = { ...state, summoner };
      emit();
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Singleton usado pelo watcher e pela rota SSE. */
export const gameState = createGameState();
