import { useEffect, useMemo, useRef, useState } from "react";
import { App as AntApp, Input, Spin } from "antd";
import { unlockAudio, playTurn, playTick } from "./sound";
import {
  getChampions,
  getChampSelect,
  hoverChampion,
  lockChampion,
  banHover,
  banChampion,
  getRunePages,
  setRunePage,
  getRecommendedRunes,
  applyRecommendedRunes,
  championIconUrl,
  getSummonerSpells,
  setSpells,
  spellIconUrl,
  getSkins,
  selectSkin,
  skinIconUrl,
  type Champion,
  type RunePage,
  type TeamMember,
  type SummonerSpell,
  type RecommendedRune,
  type Skin,
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
  const [recommended, setRecommended] = useState<RecommendedRune[]>([]);
  const [skins, setSkins] = useState<Skin[]>([]);
  const [selectedSkin, setSelectedSkin] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<{ timeLeftMs: number; receivedAt: number } | null>(null);
  const prevSecRef = useRef<number | null>(null);
  const prevTurnRef = useRef(false);

  async function loadRecommended() {
    try {
      setRecommended(await getRecommendedRunes());
    } catch {
      setRecommended([]);
    }
  }

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

  // Carrega runas recomendadas e skins quando o campeão selecionado muda (fora do ban).
  useEffect(() => {
    if (selected != null && !isBanPhase) {
      void loadRecommended();
      getSkins()
        .then((r) => {
          setSkins(r.skins);
          setSelectedSkin(r.selectedId);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, isBanPhase]);

  // Conta o timer localmente (suave) entre os polls e toca o tick nos 10s finais.
  useEffect(() => {
    const id = setInterval(() => {
      const r = timerRef.current;
      if (!r) {
        setSecondsLeft(null);
        prevSecRef.current = null;
        return;
      }
      const left = Math.max(0, Math.ceil((r.timeLeftMs - (Date.now() - r.receivedAt)) / 1000));
      setSecondsLeft(left);
      if (left <= 10 && left > 0 && left !== prevSecRef.current) playTick(left);
      prevSecRef.current = left;
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Religa o áudio no primeiro toque do usuário (autoplay policy).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
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
        if (st.timer) {
          timerRef.current = { timeLeftMs: st.timer.timeLeftMs, receivedAt: Date.now() };
        } else {
          timerRef.current = null;
        }
        // som "sua vez": pick OU ban entrou em progresso agora
        const myTurn = Boolean(st.isPickPhase) || Boolean(st.isBanPhase);
        if (myTurn && !prevTurnRef.current) playTurn();
        prevTurnRef.current = myTurn;
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
      if (isBanPhase) {
        await banHover(champ.id);
      } else {
        await hoverChampion(champ.id);
        void loadRecommended(); // runas recomendadas do campeão que passei a escolher
      }
    } catch (err) {
      message.error((err as Error).message);
    }
  }

  async function onRecommended(r: RecommendedRune) {
    try {
      await applyRecommendedRunes(r);
      message.success("Runa recomendada aplicada");
    } catch (err) {
      message.error((err as Error).message);
    }
  }

  async function onSkin(skin: Skin) {
    setSelectedSkin(skin.id); // otimista
    try {
      await selectSkin(skin.id);
      message.success("Skin trocada");
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

      {secondsLeft != null && (
        <div className={`cs-timer ${secondsLeft <= 10 ? "urgent" : ""}`}>{secondsLeft}s</div>
      )}

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

      {!isBanPhase && skins.length > 1 && (
        <div className="cs-skins">
          <p className="cs-runes-label">Skins</p>
          <div className="cs-skin-grid">
            {skins.map((sk) => (
              <button
                key={sk.id}
                type="button"
                className={`cs-skin ${selectedSkin === sk.id ? "sel" : ""}`}
                onClick={() => onSkin(sk)}
                title={sk.name}
              >
                <img
                  className="cs-skin-img"
                  src={skinIconUrl(sk.id)}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                />
                <span className="cs-skin-name">{sk.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isBanPhase && recommended.length > 0 && (
        <div className="cs-rec">
          <p className="cs-runes-label">Runas recomendadas</p>
          <div className="cs-runes">
            {recommended.map((r, i) => (
              <button
                key={i}
                type="button"
                className="cs-page"
                onClick={() => onRecommended(r)}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="divider" />

      <p className="cs-runes-label">Minhas runas</p>
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
