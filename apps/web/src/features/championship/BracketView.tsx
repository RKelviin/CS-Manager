import type { ApiMatch, ChampionshipRun } from "../../shared/apiClient";
import { theme } from "../../theme";

const { colors, spacing, radii, typography } = theme;

type BracketMatchProps = {
  match: ApiMatch;
  label?: string;
  onPlay?: () => void;
};

const BracketMatch = ({ match, label, onPlay }: BracketMatchProps) => {
  const finished = match.status === "finished";
  const score = finished ? `${match.scoreA} × ${match.scoreB}` : "vs";

  return (
    <div
      style={{
        padding: spacing.md,
        background: colors.bgInput,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.md,
        minWidth: 180
      }}
    >
      {label && (
        <div
          style={{
            fontSize: typography.fontSize.xs,
            color: colors.textDim,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: spacing.xs
          }}
        >
          {label}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontWeight: 600,
              color: match.winnerId === match.teamAId ? colors.success : colors.text,
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {match.teamA.name}
          </span>
          <span
            style={{
              fontWeight: 600,
              color: match.winnerId === match.teamBId ? colors.success : colors.text,
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {match.teamB.name}
          </span>
        </div>
        <span style={{ color: colors.textMuted, fontSize: typography.fontSize.sm, flexShrink: 0 }}>{score}</span>
      </div>
      {match.status === "scheduled" && onPlay && (
        <button
          type="button"
          onClick={onPlay}
          style={{
            marginTop: spacing.sm,
            width: "100%",
            padding: "6px 12px",
            background: colors.primary,
            border: "none",
            borderRadius: radii.sm,
            color: "#fff",
            fontSize: typography.fontSize.sm,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Jogar
        </button>
      )}
      {finished && match.winner && (
        <div style={{ marginTop: spacing.xs, fontSize: typography.fontSize.xs, color: colors.success }}>
          → {match.winner.name}
        </div>
      )}
    </div>
  );
};

/** Organiza partidas por rodada conforme o formato do campeonato */
function groupMatchesByRound(matches: ApiMatch[], format: number): ApiMatch[][] {
  if (format === 2) return [matches];
  if (format === 4) {
    const r1 = matches.filter((m) => m.round === 1);
    const r2 = matches.filter((m) => m.round === 2);
    return [r1, r2];
  }
  if (format === 8) {
    const r1 = matches.filter((m) => m.round === 1);
    const r2 = matches.filter((m) => m.round === 2);
    const r3 = matches.filter((m) => m.round === 3);
    return [r1, r2, r3];
  }
  return [matches];
}

/** Labels das rodadas */
const ROUND_LABELS: Record<number, string[]> = {
  2: ["Final"],
  4: ["Semi-finais", "Final · 3º lugar"],
  8: ["Quartas de final", "Semi-finais", "Final · 3º lugar"]
};

export function BracketView({
  run,
  onPlayMatch
}: {
  run: ChampionshipRun;
  onPlayMatch: (m: ApiMatch) => void;
}) {
  const format = run.format as 2 | 4 | 8;
  const rounds = groupMatchesByRound(run.matches, format);
  const roundLabels = ROUND_LABELS[format] ?? rounds.map((_, i) => `Rodada ${i + 1}`);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing["2xl"],
        overflowX: "auto",
        paddingBottom: spacing.lg
      }}
    >
      {rounds.map((matches, roundIdx) => (
        <div key={roundIdx}>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: 600,
              color: colors.textMuted,
              marginBottom: spacing.md,
              textTransform: "uppercase",
              letterSpacing: 0.5
            }}
          >
            {roundLabels[roundIdx]}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing.lg,
              alignItems: "flex-start"
            }}
          >
            {matches.map((m, idx) => {
              let label: string | undefined;
              if (format === 4) {
                if (roundIdx === 0) label = `Semi ${idx + 1}`;
                else label = idx === 0 ? "Final" : "3º lugar";
              } else if (format === 8) {
                if (roundIdx === 0) label = `Quarta ${idx + 1}`;
                else if (roundIdx === 1) label = `Semi ${idx + 1}`;
                else label = idx === 0 ? "Final" : "3º lugar";
              }
              return (
                <BracketMatch
                  key={m.id}
                  match={m}
                  label={label}
                  onPlay={m.status === "scheduled" ? () => onPlayMatch(m) : undefined}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
