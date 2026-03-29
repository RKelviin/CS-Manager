import { useState, useEffect } from "react";
import { useAuth } from "../features/auth";
import { rankingApi, simulationApi } from "../shared/apiClient";
import type { ApiGlobalRankingItem, ApiPlayerRankingItem } from "../shared/apiClient";
import { theme } from "../theme";

const { colors } = theme;

/** Cores por posição: 1º ouro, 2º prata, 3º bronze, 4–10 cinza */
const POSITION_COLORS: Record<number, string> = {
  1: "#ffd700",
  2: "#c0c0c0",
  3: "#cd7f32",
  4: "#8899a6",
  5: "#8899a6",
  6: "#8899a6",
  7: "#8899a6",
  8: "#8899a6",
  9: "#8899a6",
  10: "#8899a6"
};

function TeamRankingTable({ ranking, colors: c }: { ranking: ApiGlobalRankingItem[]; colors: typeof colors }) {
  return (
    <div style={{ background: c.bgInput, borderRadius: 12, border: `1px solid ${c.border}`, overflow: "hidden", marginBottom: 32 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#171b23", borderBottom: `1px solid ${c.border}` }}>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: c.textDim, fontWeight: 600 }}>#</th>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: c.textDim, fontWeight: 600 }}>Time</th>
            <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: c.textDim, fontWeight: 600 }}>Rating</th>
            <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: c.textDim, fontWeight: 600 }}>Partidas</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((item, i) => {
            const posColor = item.position <= 10 ? POSITION_COLORS[item.position] ?? c.textDim : c.textDim;
            return (
              <tr key={item.teamId} style={{ borderBottom: i < ranking.length - 1 ? `1px solid ${c.border}` : "none" }}>
                <td style={{ padding: "14px 16px", color: posColor, fontSize: 14, fontWeight: item.position <= 3 ? 700 : 400 }}>{item.position}</td>
                <td style={{ padding: "14px 16px", fontWeight: 600, color: c.text }}>{item.teamName}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: c.primaryLight }}>{item.rating}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", color: c.textMuted }}>{item.matchesPlayed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {ranking.length === 0 && (
        <div style={{ padding: 24, color: c.textDim, textAlign: "center" }}>Nenhum time no ranking ainda.</div>
      )}
    </div>
  );
}

function TeamRankingPager(props: {
  rankingLength: number;
  rankingTotal: number | null;
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  colors: typeof colors;
}) {
  const { rankingLength, rankingTotal, nextCursor, loadingMore, onLoadMore, colors: c } = props;
  return (
    <>
      {rankingTotal != null && (
        <p style={{ color: c.textDim, fontSize: 13, marginTop: -24, marginBottom: nextCursor ? 12 : 24 }}>
          {rankingLength} de {rankingTotal} times
          {nextCursor ? " — há mais abaixo." : ""}
        </p>
      )}
      {nextCursor != null && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          style={{
            display: "block",
            marginBottom: 24,
            padding: "10px 20px",
            borderRadius: 8,
            border: `1px solid ${c.border}`,
            background: c.bgInput,
            color: c.text,
            cursor: loadingMore ? "wait" : "pointer",
            fontWeight: 600
          }}
        >
          {loadingMore ? "Carregando…" : "Carregar mais times"}
        </button>
      )}
    </>
  );
}

const TEAM_PAGE_SIZE = 50;

export const RankingPage = () => {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<ApiGlobalRankingItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [rankingTotal, setRankingTotal] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playerRanking, setPlayerRanking] = useState<ApiPlayerRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNextCursor(null);
    setRankingTotal(null);
    const promises: Promise<unknown>[] = [
      rankingApi.getGlobal({ limit: TEAM_PAGE_SIZE }).then((r) => {
        if (!cancelled) {
          setRanking(r.items);
          setNextCursor(r.nextCursor);
          setRankingTotal(r.total);
        }
      })
    ];
    if (user) {
      promises.push(simulationApi.getPlayerRanking());
    }
    Promise.all(promises)
      .then((results) => {
        if (!cancelled) {
          if (user && results[1] != null) {
            setPlayerRanking((results[1] as ApiPlayerRankingItem[]) ?? []);
          } else {
            setPlayerRanking([]);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar ranking");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loadMoreTeams = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    rankingApi
      .getGlobal({ limit: TEAM_PAGE_SIZE, cursor: nextCursor })
      .then((r) => {
        setRanking((prev) => {
          const seen = new Set(prev.map((x) => x.teamId));
          const extra = r.items.filter((x) => !seen.has(x.teamId));
          return [...prev, ...extra];
        });
        setNextCursor(r.nextCursor);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar ranking"))
      .finally(() => setLoadingMore(false));
  };

  if (!user && !loading && !error) {
    return (
      <section>
        <h2 style={{ marginTop: 0, marginBottom: 8, color: colors.text }}>Ranking</h2>
        <p style={{ color: colors.textMuted, marginBottom: 24, fontSize: 14 }}>
          Ranking global por rating Elo. Faça login para ver também o ranking de jogadores (K/D/A).
        </p>
        <TeamRankingTable ranking={ranking} colors={colors} />
        <TeamRankingPager
          rankingLength={ranking.length}
          rankingTotal={rankingTotal}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          onLoadMore={loadMoreTeams}
          colors={colors}
        />
      </section>
    );
  }

  if (loading) {
    return (
      <section>
        <h2 style={{ marginTop: 0, marginBottom: 8, color: colors.text }}>Ranking</h2>
        <p style={{ color: colors.textMuted, marginBottom: 24, fontSize: 14 }}>Ranking global por rating Elo.</p>
        <div style={{ padding: 24, color: colors.textDim, textAlign: "center" }}>Carregando...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2 style={{ marginTop: 0, marginBottom: 8, color: colors.text }}>Ranking</h2>
        <p style={{ color: colors.error }}>{error}</p>
      </section>
    );
  }

  return (
    <section>
      <h2 style={{ marginTop: 0, marginBottom: 8, color: colors.text }}>Ranking</h2>
      <p style={{ color: colors.textMuted, marginBottom: 24, fontSize: 14 }}>
        Ranking global por rating Elo. Premiações: vitória (+$500), campeonato 1º $2.000, 2º $1.000, 3º $500.
      </p>

      <h3 style={{ marginBottom: 12, fontSize: 16, color: colors.text }}>Ranking de times</h3>
      <TeamRankingTable ranking={ranking} colors={colors} />
      <TeamRankingPager
        rankingLength={ranking.length}
        rankingTotal={rankingTotal}
        nextCursor={nextCursor}
        loadingMore={loadingMore}
        onLoadMore={loadMoreTeams}
        colors={colors}
      />

      <h3 style={{ marginBottom: 12, fontSize: 16, color: colors.text }}>Ranking de jogadores</h3>
      <p style={{ color: colors.textDim, fontSize: 13, margin: "0 0 12px" }}>
        K/D/A da sua temporada (partidas da liga).
      </p>
      <div style={{ background: colors.bgInput, borderRadius: 12, border: `1px solid ${colors.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#171b23", borderBottom: `1px solid ${colors.border}` }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: colors.textDim, fontWeight: 600 }}>#</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: colors.textDim, fontWeight: 600 }}>Jogador</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: colors.textDim, fontWeight: 600 }}>Time</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: colors.textDim, fontWeight: 600 }}>Função</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: colors.textDim, fontWeight: 600 }}>K</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: colors.textDim, fontWeight: 600 }}>D</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: colors.textDim, fontWeight: 600 }}>A</th>
            </tr>
          </thead>
          <tbody>
            {playerRanking.map((item, i) => (
              <tr key={item.playerId} style={{ borderBottom: i < playerRanking.length - 1 ? `1px solid ${colors.border}` : "none" }}>
                <td style={{ padding: "14px 16px", color: colors.textDim, fontSize: 14 }}>{i + 1}</td>
                <td style={{ padding: "14px 16px", fontWeight: 600, color: colors.text }}>{item.playerName}</td>
                <td style={{ padding: "14px 16px", color: colors.textMuted }}>{item.teamName}</td>
                <td style={{ padding: "14px 16px", color: colors.textDim, fontSize: 13 }}>{item.role}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", color: colors.success }}>{item.kills}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", color: colors.error }}>{item.deaths}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", color: colors.primaryLight }}>{item.assists}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {playerRanking.length === 0 && (
          <div style={{ padding: 24, color: colors.textDim, textAlign: "center" }}>
            Nenhuma partida jogada ainda. Jogue partidas para o ranking de jogadores ser preenchido.
          </div>
        )}
      </div>
    </section>
  );
};
