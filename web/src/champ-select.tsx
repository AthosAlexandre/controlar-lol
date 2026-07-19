import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Input, Spin } from "antd";
import {
  getChampions,
  getChampSelect,
  hoverChampion,
  lockChampion,
  getRunePages,
  setRunePage,
  championIconUrl,
  type Champion,
  type RunePage,
} from "./api";

export function ChampSelectScreen() {
  const { message } = AntApp.useApp();
  const [champions, setChampions] = useState<Champion[]>([]);
  const [pages, setPages] = useState<RunePage[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [locking, setLocking] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carrega campeões + páginas de runas uma vez.
  useEffect(() => {
    Promise.all([getChampions(), getRunePages()])
      .then(([c, p]) => {
        setChampions(c);
        setPages(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Poll leve do estado de pick (mantém o TRAVAR correto).
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const st = await getChampSelect();
        if (!alive) return;
        setCompleted(Boolean(st.completed));
        if (st.championId) setSelected((prev) => prev ?? st.championId!);
      } catch {
        /* ignora */
      }
    }
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? champions.filter((c) => c.name.toLowerCase().includes(q))
      : champions;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, query]);

  async function onPick(champ: Champion) {
    setSelected(champ.id);
    try {
      await hoverChampion(champ.id);
    } catch (err) {
      message.error((err as Error).message);
    }
  }

  async function onLock() {
    if (selected == null) return;
    setLocking(true);
    try {
      await lockChampion(selected);
      message.success("Campeão confirmado!");
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLocking(false);
    }
  }

  async function onRune(page: RunePage) {
    try {
      await setRunePage(page.id);
      setPages((ps) => ps.map((p) => ({ ...p, current: p.id === page.id })));
      message.success("Runa aplicada");
    } catch (err) {
      message.error((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="cs-loading">
        <Spin />
      </div>
    );
  }

  return (
    <div className="cs">
      <h1 className="headline">Seleção</h1>

      <Input
        className="cs-search"
        placeholder="Buscar campeão…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        allowClear
      />

      <div className="cs-grid">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`cs-champ ${selected === c.id ? "sel" : ""}`}
            onClick={() => onPick(c)}
            disabled={completed}
            title={c.name}
          >
            <img
              className="cs-icon"
              src={championIconUrl(c.id)}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
            <span className="cs-name">{c.name}</span>
          </button>
        ))}
      </div>

      <button
        className="accept cs-lock"
        type="button"
        onClick={onLock}
        disabled={selected == null || completed || locking}
      >
        {completed ? "Confirmado" : locking ? "Confirmando…" : "Confirmar"}
      </button>

      <div className="divider" />

      <p className="cs-runes-label">Runas</p>
      {pages.length === 0 ? (
        <p className="sub">Crie páginas de runas no PC</p>
      ) : (
        <div className="cs-runes">
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`cs-page ${p.current ? "cur" : ""}`}
              onClick={() => onRune(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
