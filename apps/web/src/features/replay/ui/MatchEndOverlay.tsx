import type { CSSProperties } from "react";
import type { MatchState } from "../types";
import { MatchEndScoreboard } from "./MatchEndScoreboard";

const restartBtnStyle: CSSProperties = {
  marginTop: 22,
  padding: "12px 32px",
  borderRadius: 10,
  border: "1px solid #5c3030",
  background: "linear-gradient(180deg, #3d2525 0%, #2a1f1f 100%)",
  color: "#fef2f2",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  letterSpacing: 0.4,
  boxShadow: "0 4px 14px rgba(0,0,0,0.35)"
};

const cardStyle: CSSProperties = {
  textAlign: "center",
  padding: "28px 28px 32px",
  borderRadius: 16,
  boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
  maxWidth: 900,
  width: "min(96vw, 900px)"
};

const green = "#22c55e";
const red = "#ef4444";

function formatPosition(pos: number): string {
  if (pos === 1) return "1º colocado";
  if (pos === 2) return "2º colocado";
  if (pos === 3) return "3º colocado";
  return `${pos}º colocado`;
}

function formatPositionChange(delta: number): string {
  if (delta > 0) return `subiu ${delta} posição${delta > 1 ? "ões" : ""}`;
  if (delta < 0) return `caiu ${-delta} posição${delta < -1 ? "ões" : ""}`;
  return "";
}

export const MatchEndOverlay = ({
  state,
  onRestart,
  userWon,
  ratingResult,
  teamPositions,
  onBackToChampionship
}: {
  state: MatchState;
  onRestart: () => void;
  userWon?: boolean;
  ratingResult?: {
    teamA: { teamId: string; teamName: string; delta: number; newRating: number };
    teamB: { teamId: string; teamName: string; delta: number; newRating: number };
  } | null;
  teamPositions?: {
    teamA: { position: number; positionChange: number };
    teamB: { position: number; positionChange: number };
  } | null;
  onBackToChampionship?: () => void;
}) => {
  if (state.matchWinner == null && !state.matchDraw) return null;

  if (state.matchDraw) {
    const node = (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Empate"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(8, 10, 18, 0.82)",
          backdropFilter: "blur(4px)",
          padding: 12,
          overflow: "auto"
        }}
      >
        <div
          style={{
            ...cardStyle,
            border: "1px solid #475569",
            background: "linear-gradient(165deg, #1e293b 0%, #121826 100%)"
          }}
        >
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
            Resultado
          </p>
          <p style={{ margin: "12px 0 8px", fontSize: 32, fontWeight: 800, color: "#cbd5e1" }}>Empate</p>

          <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase" }}>
            Placar final
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 36, fontWeight: 700, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ color: "#fb923c" }}>{state.teamAName} {state.score.RED}</span>
            <span style={{ color: "#64748b", fontSize: 24 }}>|</span>
            <span style={{ color: "#60a5fa" }}>{state.teamBName} {state.score.BLU}</span>
          </p>

          <MatchEndScoreboard state={state} />

          {ratingResult && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #334155" }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase" }}>Rating</p>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, fontWeight: 600 }}>
                  <span>
                    {state.teamAName}{" "}
                    <span style={{ color: "#e2e8f0" }}>{ratingResult.teamA.newRating} pts</span>
                    <span style={{ color: ratingResult.teamA.delta >= 0 ? green : red, marginLeft: 6 }}>
                      ({ratingResult.teamA.delta >= 0 ? "+" : ""}{ratingResult.teamA.delta})
                    </span>
                    {teamPositions && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                        · {formatPosition(teamPositions.teamA.position)}
                        {teamPositions.teamA.positionChange !== 0 && ` · ${formatPositionChange(teamPositions.teamA.positionChange)}`}
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, fontWeight: 600 }}>
                  <span>
                    {state.teamBName}{" "}
                    <span style={{ color: "#e2e8f0" }}>{ratingResult.teamB.newRating} pts</span>
                    <span style={{ color: ratingResult.teamB.delta >= 0 ? green : red, marginLeft: 6 }}>
                      ({ratingResult.teamB.delta >= 0 ? "+" : ""}{ratingResult.teamB.delta})
                    </span>
                    {teamPositions && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                        · {formatPosition(teamPositions.teamB.position)}
                        {teamPositions.teamB.positionChange !== 0 && ` · ${formatPositionChange(teamPositions.teamB.positionChange)}`}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onBackToChampionship ?? onRestart}
            style={restartBtnStyle}
          >
            {onBackToChampionship ? "Voltar ao campeonato" : "Sair"}
          </button>
        </div>
      </div>
    );
    return typeof document !== "undefined" ? node : null;
  }

  const winnerLabel = state.matchWinner === "RED" ? state.teamAName : state.teamBName;
  const winnerColor = state.matchWinner === "RED" ? "#fb923c" : "#60a5fa";

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fim de partida"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(8, 10, 18, 0.82)",
        backdropFilter: "blur(4px)",
        padding: 12,
        overflow: "auto"
      }}
    >
      <div
        style={{
          ...cardStyle,
          border: "1px solid #334155",
          background: "linear-gradient(165deg, #1a2235 0%, #121826 100%)"
        }}
      >
        <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
          Vencedor
        </p>
        <p style={{ margin: "12px 0 8px", fontSize: 32, fontWeight: 800, color: winnerColor }}>{winnerLabel}</p>

        <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase" }}>
          Placar final
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 36, fontWeight: 700, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ color: "#fb923c" }}>{state.teamAName} {state.score.RED}</span>
          <span style={{ color: "#64748b", fontSize: 24 }}>|</span>
          <span style={{ color: "#60a5fa" }}>{state.teamBName} {state.score.BLU}</span>
        </p>

        <MatchEndScoreboard state={state} />

        {ratingResult && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #334155" }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase" }}>
              Rating
            </p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, fontWeight: 600, flexWrap: "wrap", justifyContent: "center" }}>
                <span>
                  {state.teamAName}{" "}
                  <span style={{ color: "#e2e8f0" }}>{ratingResult.teamA.newRating} pts</span>
                  <span style={{ color: ratingResult.teamA.delta >= 0 ? green : red, marginLeft: 6 }}>
                    ({ratingResult.teamA.delta >= 0 ? "+" : ""}{ratingResult.teamA.delta})
                  </span>
                  {teamPositions && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                      · {formatPosition(teamPositions.teamA.position)}
                      {teamPositions.teamA.positionChange !== 0 && ` · ${formatPositionChange(teamPositions.teamA.positionChange)}`}
                    </span>
                  )}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, fontWeight: 600, flexWrap: "wrap", justifyContent: "center" }}>
                <span>
                  {state.teamBName}{" "}
                  <span style={{ color: "#e2e8f0" }}>{ratingResult.teamB.newRating} pts</span>
                  <span style={{ color: ratingResult.teamB.delta >= 0 ? green : red, marginLeft: 6 }}>
                    ({ratingResult.teamB.delta >= 0 ? "+" : ""}{ratingResult.teamB.delta})
                  </span>
                  {teamPositions && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                      · {formatPosition(teamPositions.teamB.position)}
                      {teamPositions.teamB.positionChange !== 0 && ` · ${formatPositionChange(teamPositions.teamB.positionChange)}`}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {!ratingResult && (state.matchWinner || state.matchDraw) && (
          <p style={{ margin: "16px 0 0", fontSize: 12, color: "#64748b" }}>Calculando rating...</p>
        )}

        {userWon && (
          <p style={{ margin: "16px 0 0", fontSize: 14, color: "#fbbf24", fontWeight: 600 }}>
            Premiação: +$500 pela vitória!
          </p>
        )}
        <button
          type="button"
          onClick={onBackToChampionship ?? onRestart}
          style={restartBtnStyle}
        >
          {onBackToChampionship ? "Voltar ao campeonato" : "Sair"}
        </button>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? node : null;
};
