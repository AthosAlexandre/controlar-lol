import { useEffect, useState } from "react";
import { Switch } from "antd";
import type { GameState } from "./api";

interface BodyProps {
  state: GameState;
  auto: boolean;
  accepting: boolean;
  onAccept: () => void;
  onToggle: (value: boolean) => void;
}

/** Escolhe o miolo do card conforme a fase. */
export function CardBody(p: BodyProps) {
  switch (p.state.phase) {
    case "Matchmaking":
      return <QueueBody />;
    case "ReadyCheck":
      return <FoundBody accepting={p.accepting} onAccept={p.onAccept} />;
    case "ChampSelect":
      return <SelectBody />;
    case "InProgress":
      return <InGameBody />;
    case "Offline":
      return <OfflineBody />;
    default:
      return <IdleBody state={p.state} auto={p.auto} onToggle={p.onToggle} />;
  }
}

function IdleBody({
  state,
  auto,
  onToggle,
}: Pick<BodyProps, "state" | "auto" | "onToggle">) {
  const s = state.summoner;
  return (
    <>
      <h1 className="nick">
        {s ? s.name : "—"}
        {s && <span className="tag">#{s.tagLine}</span>}
      </h1>
      <p className="level">{s ? `Nível ${s.level}` : "Fora de fila"}</p>
      <div className="divider" />
      <label className="auto">
        <span className="auto-text">
          <span className="auto-title">Auto-aceitar</span>
          <span className="auto-sub">Aceita a partida sozinho</span>
        </span>
        <Switch checked={auto} onChange={onToggle} />
      </label>
    </>
  );
}

function QueueBody() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <>
      <h1 className="headline">Em Fila</h1>
      <p className="sub">Procurando partida…</p>
      <div className="timer">
        {mm}:{ss}
      </div>
    </>
  );
}

function FoundBody({
  accepting,
  onAccept,
}: Pick<BodyProps, "accepting" | "onAccept">) {
  return (
    <>
      <h1 className="headline gold">Partida Encontrada!</h1>
      <button className="accept" type="button" onClick={onAccept} disabled={accepting}>
        {accepting ? "Aceitando…" : "Aceitar"}
      </button>
    </>
  );
}

function SelectBody() {
  return (
    <>
      <h1 className="headline">Seleção</h1>
      <p className="sub">Na seleção de campeões</p>
    </>
  );
}

function InGameBody() {
  return (
    <>
      <h1 className="headline">Em Jogo</h1>
      <p className="sub">Partida em andamento</p>
    </>
  );
}

function OfflineBody() {
  return (
    <>
      <h1 className="headline muted">LoL fechado</h1>
      <p className="sub">Abra o cliente do LoL</p>
    </>
  );
}
