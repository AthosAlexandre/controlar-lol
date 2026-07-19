import { useEffect, useState } from "react";
import { App as AntApp } from "antd";
import {
  subscribeEvents,
  accept,
  getAutoAccept,
  setAutoAccept,
  type GameState,
} from "./api";
import { CardBody } from "./screens";
import "./App.css";

const OFFLINE: GameState = { phase: "Offline", summoner: null };

export default function App() {
  const { message } = AntApp.useApp();
  const [state, setState] = useState<GameState>(OFFLINE);
  const [connected, setConnected] = useState(false);
  const [auto, setAuto] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Assina o stream de estado; a tela passa a reagir sozinha.
  useEffect(() => {
    return subscribeEvents((s) => {
      setConnected(true);
      setState(s);
    });
  }, []);

  // Lê o estado do auto-aceitar ao montar.
  useEffect(() => {
    getAutoAccept()
      .then(setAuto)
      .catch(() => {});
  }, []);

  async function onAccept() {
    setAccepting(true);
    try {
      await accept();
      message.success("Partida aceita!");
    } catch (err) {
      message.error((err as Error).message || "Falha ao aceitar");
    } finally {
      setAccepting(false);
    }
  }

  async function onToggle(value: boolean) {
    try {
      const now = await setAutoAccept(value);
      setAuto(now);
      message.info(now ? "Auto-aceitar ligado" : "Auto-aceitar desligado");
    } catch {
      message.error("Não foi possível mudar o auto-aceitar");
    }
  }

  const online = connected && state.phase !== "Offline";

  return (
    <main className="stage">
      <p className="eyebrow">Modo Banheiro</p>

      <section className="panel" aria-live="polite">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />

        <div className={`status ${online ? "on" : "off"}`}>
          <span className="dot" />
          {online ? "Conectado" : "LoL fechado"}
        </div>

        <CardBody
          state={state}
          auto={auto}
          accepting={accepting}
          onAccept={onAccept}
          onToggle={onToggle}
        />
      </section>
    </main>
  );
}
