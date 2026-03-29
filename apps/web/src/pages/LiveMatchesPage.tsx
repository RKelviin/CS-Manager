import { useCallback, useEffect, useMemo, useState } from "react";
import { matchRegistry, useMatch, useMatchContext } from "../features/replay";
import { LiveSpectatorLayout } from "../features/replay/ui";
import {
  avgTeamsRankingScore,
  fallbackTeamRating,
  lookupGlobalRankingTeam
} from "../features/replay/utils/matchRankingLookup";
import { rankingApi } from "../shared/apiClient";
import type { ApiGlobalRankingItem } from "../shared/apiClient";
import { theme } from "../theme";

const { colors, spacing, radii, typography } = theme;

const TeamRankLine = ({
  teamName,
  ranking
}: {
  teamName: string;
  ranking: ApiGlobalRankingItem[];
}) => {
  const row = lookupGlobalRankingTeam(ranking, teamName);
  const rating = row?.rating ?? fallbackTeamRating(teamName);
  const posLabel = row != null ? `#${row.position}` : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span
        style={{
          fontSize: typography.fontSize.md,
          fontWeight: typography.fontWeight.semibold,
          color: colors.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {teamName}
      </span>
      <span style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
        Ranking {posLabel} · rating {Math.round(rating)}
      </span>
    </div>
  );
};

const LiveMatchListRow = ({
  matchId,
  ranking,
  selected,
  onSelect
}: {
  matchId: string;
  ranking: ApiGlobalRankingItem[];
  selected: boolean;
  onSelect: () => void;
}) => {
  const { state } = useMatch(matchId);
  if (!state) return null;
  const ended = state.matchWinner != null || state.matchDraw;
  if (ended) return null;

  const avg = avgTeamsRankingScore(state, ranking);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr auto",
          alignItems: "center",
          gap: spacing.md,
          padding: `${spacing.md}px ${spacing.lg}px`,
          textAlign: "left",
          background: selected ? "rgba(99, 102, 241, 0.12)" : colors.bgInput,
          border: `1px solid ${selected ? colors.primary : colors.border}`,
          borderRadius: radii.md,
          marginBottom: spacing.sm,
          cursor: "pointer",
          color: "inherit",
          font: "inherit"
        }}
      >
        <TeamRankLine teamName={state.teamAName} ranking={ranking} />
        <div
          style={{
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.bold,
            color: colors.textMuted,
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0
          }}
        >
          {state.score.RED} – {state.score.BLU}
        </div>
        <TeamRankLine teamName={state.teamBName} ranking={ranking} />
        <span
          style={{
            fontSize: typography.fontSize.xs,
            color: colors.textDim,
            justifySelf: "end"
          }}
          title={`Média ranking (rating) ≈ ${Math.round(avg)}`}
        >
          R{state.round}
          {state.isRunning ? " ●" : ""}
        </span>
      </button>
    </li>
  );
};

const FeaturedLoader = ({ matchId }: { matchId: string }) => {
  const { state } = useMatch(matchId);
  if (!state) {
    return (
      <div style={{ padding: spacing["2xl"], textAlign: "center", color: colors.textDim }}>
        Carregando partida…
      </div>
    );
  }
  return <LiveSpectatorLayout state={state} />;
};

export const LiveMatchesPage = () => {
  const context = useMatchContext();
  const [ranking, setRanking] = useState<ApiGlobalRankingItem[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRankingLoading(true);
    setRankingError(null);
    rankingApi
      .getGlobalAll(500)
      .then((items) => {
        if (!cancelled) setRanking(items);
      })
      .catch((e) => {
        if (!cancelled) {
          setRanking([]);
          setRankingError(e instanceof Error ? e.message : "Ranking indisponível");
        }
      })
      .finally(() => {
        if (!cancelled) setRankingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const idsKey = context ? [...context.listMatchIds()].sort().join(",") : "";

  const sortedLiveIds = useMemo(() => {
    if (!context || !idsKey) return [];
    const ids = context.listMatchIds();
    const live = ids.filter((id) => {
      const s = matchRegistry.getMatch(id);
      return s && s.matchWinner == null && !s.matchDraw;
    });
    return [...live].sort((a, b) => {
      const sa = matchRegistry.getMatch(a);
      const sb = matchRegistry.getMatch(b);
      if (!sa || !sb) return 0;
      return avgTeamsRankingScore(sb, ranking) - avgTeamsRankingScore(sa, ranking);
    });
  }, [context, idsKey, ranking]);

  useEffect(() => {
    if (sortedLiveIds.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((cur) => {
      if (cur && sortedLiveIds.includes(cur)) return cur;
      return sortedLiveIds[0]!;
    });
  }, [sortedLiveIds]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  if (!context) {
    return (
      <section>
        <h2 style={{ marginTop: 0, marginBottom: spacing.md }}>Partidas ao vivo</h2>
        <p style={{ color: colors.textDim }}>Carregando...</p>
      </section>
    );
  }

  return (
    <section>
      <header style={{ marginBottom: spacing.xl }}>
        <h2
          style={{
            marginTop: 0,
            marginBottom: spacing.sm,
            fontSize: typography.fontSize["2xl"],
            fontWeight: typography.fontWeight.bold,
            color: colors.text
          }}
        >
          Partidas ao vivo
        </h2>
        <p style={{ color: colors.textMuted, margin: 0, fontSize: typography.fontSize.md }}>
          Destaque: partida com maior média de rating dos dois times. Escolha outra linha para alternar o
          foco nesta página.
        </p>
        {rankingLoading && (
          <p style={{ color: colors.textDim, marginTop: spacing.sm, fontSize: typography.fontSize.sm }}>
            Carregando ranking global…
          </p>
        )}
        {rankingError && (
          <p style={{ color: colors.textMuted, marginTop: spacing.sm, fontSize: typography.fontSize.sm }}>
            {rankingError} — ordenação usa ratings estimados por nome.
          </p>
        )}
      </header>

      {sortedLiveIds.length === 0 ? (
        <div
          style={{
            padding: spacing["3xl"],
            textAlign: "center",
            background: colors.bgInput,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.lg,
            color: colors.textDim,
            fontSize: typography.fontSize.md
          }}
        >
          Nenhuma partida em andamento.
          <br />
          <span style={{ fontSize: typography.fontSize.sm }}>
            Inicie uma partida na aba Simulação (as partidas já terminadas não aparecem aqui).
          </span>
        </div>
      ) : (
        <>
          <div
            style={{
              marginBottom: spacing["2xl"],
              padding: spacing.lg,
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.lg
            }}
          >
            {selectedId ? <FeaturedLoader matchId={selectedId} /> : null}
          </div>

          <h3
            style={{
              margin: `0 0 ${spacing.md}px`,
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.semibold,
              color: colors.text
            }}
          >
            Todas as partidas em andamento
          </h3>
          <p style={{ margin: `0 0 ${spacing.lg}px`, fontSize: typography.fontSize.sm, color: colors.textMuted }}>
            Ordenadas pela média do rating dos dois times (maior primeiro). Clique numa linha para ver o jogo
            em cima.
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {sortedLiveIds.map((matchId) => (
              <LiveMatchListRow
                key={matchId}
                matchId={matchId}
                ranking={ranking}
                selected={matchId === selectedId}
                onSelect={() => handleSelect(matchId)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
