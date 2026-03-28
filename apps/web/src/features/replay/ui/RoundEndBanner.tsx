import { getTeamDisplayColor } from "../engine/matchConstants";
import type { MatchState, TeamSide } from "../types";
import { matchEndReasonLabel } from "./matchEndReasonLabel";

const teamName = (winner: TeamSide, state: MatchState) =>
  winner === "RED" ? state.teamAName : state.teamBName;

/** Sobreposto ao centro da area do canvas (pai com position: relative) */
export const RoundEndBanner = ({ state }: { state: MatchState }) => {
  const b = state.roundEndBanner;
  if (b == null) return null;

  const color = getTeamDisplayColor(b.winner, state.round, "primary", state.teamAStartsAs);
  const sec = Math.max(0, Math.ceil(state.roundEndBannerMs / 1000));

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
        pointerEvents: "none",
        borderRadius: 12
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          maxWidth: "min(440px, 92%)",
          width: "100%",
          padding: "20px 24px",
          borderRadius: 12,
          border: "1px solid rgba(148, 163, 184, 0.4)",
          background: "linear-gradient(165deg, rgba(17, 23, 34, 0.97) 0%, rgba(12, 16, 24, 0.98) 100%)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
          textAlign: "center",
          backdropFilter: "blur(6px)"
        }}
      >
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>
          Round <span style={{ fontVariantNumeric: "tabular-nums", color: "#f1f5f9" }}>{b.roundNumber}</span>
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 20, fontWeight: 700, color }}>
          Time {teamName(b.winner, state)} venceu
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 15, color: "#cbd5e1", lineHeight: 1.4 }}>
          {matchEndReasonLabel(b.cause)}
        </p>
        <p style={{ margin: "14px 0 0", fontSize: 13, color: "#64748b" }}>
          continua em {sec}
        </p>
      </div>
    </div>
  );
};
