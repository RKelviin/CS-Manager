import { useMemo, useState, useSyncExternalStore } from "react";
import { DUST2_MAP } from "../map/dust2Map";
import { matchRegistry } from "../state/matchRegistry";
import type { MatchState } from "../types";
import { useMatchContext, useMatch } from "../state/MatchContext";
import { theme } from "../../../theme";

const { colors, radii, typography } = theme;

/** Chave visual estável para fundir chips duplicados (mesmo confronto e estado de jogo). */
const chipFingerprint = (st: MatchState): string =>
  [
    st.teamAName,
    st.teamBName,
    st.mapData?.name ?? DUST2_MAP.name,
    st.round,
    st.score.RED,
    st.score.BLU,
    st.isRunning ? "run" : "pause",
    st.matchWinner ?? "",
    st.matchDraw ? "d" : ""
  ].join("|");

/** Mantém um ID por fingerprint; em empate, o último na ordem do registry prevalece (criação mais recente). */
const dedupeMatchIdsForChips = (ids: string[]): string[] => {
  const fpToId = new Map<string, string>();
  for (const id of ids) {
    const st = matchRegistry.getMatch(id);
    if (!st) continue;
    fpToId.set(chipFingerprint(st), id);
  }
  return [...fpToId.values()];
};

/** Barra com partidas ativas e campo para assistir por ID */
export const ActiveMatchesBar = () => {
  const context = useMatchContext();
  const structuralVersion = useSyncExternalStore(
    (cb) => matchRegistry.subscribeStructural(cb),
    () => matchRegistry.getStructuralVersion(),
    () => 0
  );

  if (!context) return null;

  const { listMatchIds, watchMatch, cleanupRegistry } = context;
  const rawIds = listMatchIds();
  const ids = useMemo(
    () => dedupeMatchIdsForChips(rawIds),
    [structuralVersion, rawIds.join("|")]
  );

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      {ids.length > 0 && (
        <>
          <ActiveMatchChips ids={ids} onWatch={watchMatch} />
          <button
            type="button"
            onClick={() => cleanupRegistry()}
            style={{
              padding: "6px 10px",
              background: colors.bgInput,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.md,
              color: colors.textMuted,
              fontSize: typography.fontSize.sm,
              cursor: "pointer"
            }}
            title="Remove do registry as partidas já finalizadas (vitória ou empate)"
          >
            Limpar encerradas
          </button>
        </>
      )}
      <WatchByIdForm onWatch={watchMatch} />
    </div>
  );
};

const ActiveMatchChips = ({ ids, onWatch }: { ids: string[]; onWatch: (id: string) => void }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
    {ids.map((id) => (
      <ActiveMatchChip key={id} matchId={id} onWatch={() => onWatch(id)} />
    ))}
  </div>
);

const ActiveMatchChip = ({ matchId, onWatch }: { matchId: string; onWatch: () => void }) => {
  const { state } = useMatch(matchId);
  if (!state) return null;
  const ended = state.matchWinner != null || state.matchDraw;
  return (
    <button
      type="button"
      onClick={onWatch}
      style={{
        padding: "6px 12px",
        background: ended ? "#334155" : "#1e293b",
        border: "1px solid #475569",
        borderRadius: 8,
        color: "#e2e8f0",
        fontSize: 12,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8
      }}
      title={`ID: ${matchId}`}
    >
      <span>
        {state.teamAName} {state.score.RED}-{state.score.BLU} {state.teamBName}
      </span>
      <span style={{ color: "#64748b", fontSize: 11 }}>
        R{state.round}
        {state.isRunning ? " ●" : ""}
      </span>
    </button>
  );
};

const WatchByIdForm = ({ onWatch }: { onWatch: (id: string) => void }) => {
  const [id, setId] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = id.trim();
        if (v) {
          onWatch(v);
          setId("");
        }
      }}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      <input
        type="text"
        placeholder="ID da partida"
        value={id}
        onChange={(e) => setId(e.target.value)}
        style={{
          width: 220,
          padding: "6px 10px",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 6,
          color: "#e2e8f0",
          fontSize: 12
        }}
        title="Cole o ID da partida para assistir"
      />
      <button
        type="submit"
        style={{
          padding: "6px 12px",
          background: "#2563eb",
          border: "none",
          borderRadius: 6,
          color: "#fff",
          fontSize: 12,
          cursor: "pointer",
          fontWeight: 500
        }}
      >
        Assistir
      </button>
    </form>
  );
};
