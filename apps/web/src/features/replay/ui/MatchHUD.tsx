import {
  FIRST_ROUND_SECOND_HALF,
  getTeamDisplayColor,
  getTrTeamFromState
} from "../engine/matchConstants";
import type { MatchState } from "../types";

const formatTime = (ms: number) => {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const countAlive = (state: MatchState, team: "RED" | "BLU") =>
  state.bots.filter((b) => b.team === team && b.hp > 0).length;

/** Linha curta (ex.: c4 plantada) — usada também ao lado dos controles */
export const bombLineShort = (state: MatchState): string => {
  if (state.matchWinner != null || state.matchDraw) {
    return "partida encerrada";
  }
  if (state.bombPlanted && state.bombPlantSite) {
    return "c4 plantada";
  }
  const carrier = state.bots.find((b) => b.team === getTrTeamFromState(state) && b.hasBomb && b.hp > 0);
  if (carrier && state.plantProgressMs > 0) {
    return "plantando c4";
  }
  if (state.bombDroppedAt) return "c4 no chao";
  if (carrier) return "c4 no time";
  return "c4 em jogo";
};

/** Estrutura padrao: placar | tempo | vivos | bomba. Cores TR/CT invertem no round 7 (2.º half). */
export const MatchHUD = ({ state }: { state: MatchState }) => {
  const aliveRed = countAlive(state, "RED");
  const aliveBlu = countAlive(state, "BLU");
  /** Com C4 plantada, o placar mostra o tempo ate a explosao (nao o relogio do round) */
  const bombActive = state.bombPlanted && state.bombPlantSite != null;
  const timerMs = bombActive ? state.postPlantTimeLeftMs : state.timeLeftMs;
  const isSecondHalf = state.round >= FIRST_ROUND_SECOND_HALF;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 14,
        padding: "14px 18px",
        background: "linear-gradient(180deg, #1e2433 0%, #151a26 100%)",
        border: "1px solid #2a3142",
        borderRadius: 10,
        fontWeight: 600,
        letterSpacing: 0.2,
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)"
      }}
    >
      {/* Placar: Team A | score | Team B — cores invertem no 2.º half (TR laranja, CT azul) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "baseline",
          gap: 12,
          fontSize: 20,
          fontVariantNumeric: "tabular-nums"
        }}
      >
        <span
          style={{
            color: getTeamDisplayColor("RED", state.round, "primary", state.teamAStartsAs),
            textAlign: "right"
          }}
        >
          {state.teamAName}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 6
          }}
        >
          <span style={{ color: getTeamDisplayColor("RED", state.round, "primary", state.teamAStartsAs) }}>
            {state.score.RED}
          </span>
          <span style={{ color: "#64748b", fontWeight: 500 }}>-</span>
          <span style={{ color: getTeamDisplayColor("BLU", state.round, "primary", state.teamAStartsAs) }}>
            {state.score.BLU}
          </span>
        </span>
        <span
          style={{
            color: getTeamDisplayColor("BLU", state.round, "primary", state.teamAStartsAs),
            textAlign: "left"
          }}
        >
          {state.teamBName}
        </span>
      </div>

      {/* 2.º tempo: indica troca de lados (cores TR/CT ja invertidas) */}
      {isSecondHalf && (
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 0.8
          }}
        >
          2.º tempo · lados invertidos
        </div>
      )}

      {/* Tempo: round (normal) ou countdown da bomba (vermelho apos plant) */}
      <div
        style={{
          textAlign: "center",
          fontSize: 17,
          fontVariantNumeric: "tabular-nums",
          color: bombActive ? "#f87171" : "#e2e8f0",
          textShadow: bombActive ? "0 0 12px rgba(248, 113, 113, 0.35)" : undefined
        }}
        title={bombActive ? "Tempo ate explosao da C4" : "Tempo restante do round"}
      >
        {formatTime(timerMs)}
      </div>

      {/* Players vivos — cores por lado atual (TR/CT) */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          fontSize: 18,
          fontVariantNumeric: "tabular-nums",
          color: "#cbd5e1"
        }}
      >
        <span style={{ color: getTeamDisplayColor("RED", state.round, "primary", state.teamAStartsAs) }}>{aliveRed}</span>
        <span style={{ color: "#64748b", fontSize: 14 }}>vs</span>
        <span style={{ color: getTeamDisplayColor("BLU", state.round, "primary", state.teamAStartsAs) }}>{aliveBlu}</span>
      </div>

      <p
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 600,
          color: "#fbbf24",
          textTransform: "lowercase",
          letterSpacing: 0.2
        }}
        title="Estado da C4 / bomba"
      >
        {bombLineShort(state)}
      </p>
      {state.id && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 6,
            fontSize: 11,
            color: "#64748b"
          }}
        >
          <span title="ID para assistir em outras telas">ID: {state.id.slice(0, 8)}…</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(state.id!);
            }}
            style={{
              padding: "2px 8px",
              background: "transparent",
              border: "1px solid #475569",
              borderRadius: 4,
              color: "#94a3b8",
              fontSize: 10,
              cursor: "pointer"
            }}
          >
            Copiar
          </button>
        </div>
      )}
    </div>
  );
};
