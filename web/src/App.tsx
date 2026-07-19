import { useEffect, useState } from "react";
import { App as AntApp, Switch } from "antd";
import {
  getSummoner,
  accept,
  getAutoAccept,
  setAutoAccept,
  type Summoner,
} from "./api";
import "./App.css";

export default function App() {
  const { message } = AntApp.useApp();
  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [online, setOnline] = useState(false);
  const [auto, setAuto] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Poll do status a cada 3s para refletir o LoL aberto/fechado.
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const s = await getSummoner();
        if (alive) {
          setSummoner(s);
          setOnline(true);
        }
      } catch {
        if (alive) setOnline(false);
      }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
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

        <h1 className="nick">
          {summoner ? summoner.name : "—"}
          {summoner && <span className="tag">#{summoner.tagLine}</span>}
        </h1>
        <p className="level">
          {summoner ? `Nível ${summoner.level}` : "Abra o cliente do LoL"}
        </p>

        <button
          className="accept"
          type="button"
          onClick={onAccept}
          disabled={!online || accepting}
        >
          {accepting ? "Aceitando…" : "Aceitar"}
        </button>

        <div className="divider" />

        <label className="auto">
          <span className="auto-text">
            <span className="auto-title">Auto-aceitar</span>
            <span className="auto-sub">Aceita a partida sozinho</span>
          </span>
          <Switch checked={auto} onChange={onToggle} />
        </label>
      </section>
    </main>
  );
}
