import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Input, Spin } from "antd";
import {
  getChampions,
  getChampSelect,
  hoverChampion,
  lockChampion,
  banHover,
  banChampion,
  getRunePages,
  setRunePage,
  championIconUrl,
  getSummonerSpells,
  setSpells,
  spellIconUrl,
  type Champion,
  type RunePage,
  type TeamMember,
  type SummonerSpell,
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
  const [isBanPhase, setIsBanPhase] = useState(false);
  const [banned, setBanned] = useState(false);

  const [myTeam, setMyTeam] = useState<TeamMember[]>([]);
  const [theirTeam, setTheirTeam] = useState<TeamMember[]>([]);
  const [spells, setSpells2] = useState<{ spell1Id: number; spell2Id: number } | null>(null);
  const [spellList, setSpellList] = useState<SummonerSpell[]>([]);
  const [editingSlot, setEditingSlot] = useState<1 | 2 | null>(null);

  // Carrega campeões, páginas de runas e feitiços uma vez.
  useEffect(() => {
    Promise.all([getChampions(), getRunePages()])
      .then(([c, p]) => {
        setChampions(c);
        setPages(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getSummonerSpells()
      .then(setSpellList)
      .catch(() => {});
  }, []);

  // Poll leve do estado de pick + times + feitiços.
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const st = await getChampSelect();
        if (!alive) return;
        setCompleted(Boolean(st.completed));
        setIsBanPhase(Boolean(st.isBanPhase));
        setBanned(Boolean(st.ban?.completed));
        if (st.championId) setSelected((prev) => prev ?? st.championId!);
        setMyTeam(st.myTeam ?? []);
        setTheirTeam(st.theirTeam ?? []);
        setSpells2(st.mySpells ?? null);
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
      if (isBanPhase) await banHover(champ.id);
      else await hoverChampion(champ.id);
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

  async function onBan() {
    if (selected == null) return;
    setLocking(true);
    try {
      await banChampion(selected);
      message.success("Campeão banido!");
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

  async function onPickSpell(spellId: number) {
    if (!spells || editingSlot == null) return;
    const next =
      editingSlot === 1
        ? { spell1Id: spellId, spell2Id: spells.spell2Id }
        : { spell1Id: spells.spell1Id, spell2Id: spellId };
    setSpells2(next); // otimista
    setEditingSlot(null);
    try {
      await setSpells(next.spell1Id, next.spell2Id);
      message.success("Feitiço trocado");
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
      <h1 className={`headline ${isBanPhase ? "ban" : ""}`}>
        {isBanPhase ? "Banir campeão" : "Seleção"}
      </h1>

      <div className="cs-teams">
        <TeamRow label="Seu time" members={myTeam} accent="ally" />
        <TeamRow label="Inimigo" members={theirTeam} accent="enemy" />
      </div>

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

      {isBanPhase ? (
        <button
          className="accept cs-lock cs-ban"
          type="button"
          onClick={onBan}
          disabled={selected == null || banned || locking}
        >
          {banned ? "Banido" : locking ? "Banindo…" : "Banir"}
        </button>
      ) : (
        <button
          className="accept cs-lock"
          type="button"
          onClick={onLock}
          disabled={selected == null || completed || locking}
        >
          {completed ? "Confirmado" : locking ? "Confirmando…" : "Confirmar"}
        </button>
      )}

      {spells && spellList.length > 0 && (
        <div className="cs-spells">
          <p className="cs-runes-label">Feitiços</p>
          <div className="cs-spell-slots">
            <button type="button" className="cs-spell-slot" onClick={() => setEditingSlot(1)}>
              <span className="cs-key">D</span>
              <img className="cs-spell-icon" src={spellIconUrl(spells.spell1Id)} alt="" />
            </button>
            <button type="button" className="cs-spell-slot" onClick={() => setEditingSlot(2)}>
              <span className="cs-key">F</span>
              <img className="cs-spell-icon" src={spellIconUrl(spells.spell2Id)} alt="" />
            </button>
          </div>
          {editingSlot && (
            <div className="cs-spell-picker">
              {spellList.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  className="cs-spell-opt"
                  title={sp.name}
                  onClick={() => onPickSpell(sp.id)}
                >
                  <img src={spellIconUrl(sp.id)} alt={sp.name} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

const POSITION_LABEL: Record<string, string> = {
  top: "TOP",
  jungle: "JG",
  middle: "MID",
  bottom: "ADC",
  utility: "SUP",
};

function TeamRow({
  label,
  members,
  accent,
}: {
  label: string;
  members: TeamMember[];
  accent: "ally" | "enemy";
}) {
  return (
    <div className={`cs-team ${accent}`}>
      <span className="cs-team-label">{label}</span>
      <div className="cs-team-slots">
        {members.map((m) => (
          <div key={m.cellId} className="cs-slot" title={m.position}>
            {m.championId > 0 ? (
              <img className="cs-slot-icon" src={championIconUrl(m.championId)} alt="" />
            ) : (
              <div className="cs-slot-empty" />
            )}
            {m.position && (
              <span className="cs-slot-pos">{POSITION_LABEL[m.position] ?? ""}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
