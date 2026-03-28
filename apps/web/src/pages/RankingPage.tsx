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

export const RankingPage = () => {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<ApiGlobalRankingItem[]>([]);
  const [playerRanking, setPlayerRanking] = useState<ApiPlayerRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const promises: Promise<unknown>[] = [rankingApi.getGlobal().then((r) => r.items)];
    if (user) {
      promises.push(simulationApi.getPlayerRanking());
    }
    Promise.all(promises)
      .then(([teamList, playerList]) => {
        if (!cancelled) {
          setRanking((teamList as ApiGlobalRankingItem[]) ?? []);
          setPlayerRanking((playerList as ApiPlayerRankingItem[]) ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar ranking");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!user && !loading && !error) {
    return (
      <section>
        <h2 style={{ marginTop: 0, marginBottom: 8, color: colors.text }}>Ranking</h2>
        <p style={{ color: colors.textMuted, marginBottom: 24, fontSize: 14 }}>
          Ranking global por rating Elo. Faça login para ver também o ranking de jogadores (K/D/A).
        </p>
        <TeamRankingTable ranking={ranking} colors={colors} />
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
