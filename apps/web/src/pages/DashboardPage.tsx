import { useState, useEffect } from "react";
import { useAuth } from "../features/auth";
import { useUserTeam, TeamCard } from "../features/team";
import { useMarket } from "../features/market";
import { useMatchContext, useMatch } from "../features/replay";
import { simulationApi } from "../shared/apiClient";
import type {
  ApiMatch,
  ApiPlayerRankingItem,
  ApiRankingItem
} from "../shared/apiClient";
import { theme } from "../theme";

const { colors, spacing, radii, typography } = theme;

const cardStyle = {
  background: colors.bgCard,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.xl,
  padding: spacing.lg,
  overflow: "hidden" as const
};

/** Card com partidas ativas no registry — permite assistir a partir do Dashboard */
const ActiveMatchesCard = () => {
  const context = useMatchContext();
  if (!context) return null;
  const ids = context.listMatchIds();
  if (ids.length === 0) return null;
  return (
    <div style={cardStyle}>
      <CardTitle title="Partidas em andamento" subtitle="Clique para assistir" />
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {ids.map((matchId) => (
          <ActiveMatchItem key={matchId} matchId={matchId} onWatch={() => context.watchMatch(matchId)} />
        ))}
      </ul>
    </div>
  );
};

const ActiveMatchItem = ({ matchId, onWatch }: { matchId: string; onWatch: () => void }) => {
  const { state } = useMatch(matchId);
  if (!state) return null;
  const ended = state.matchWinner != null || state.matchDraw;
  return (
    <li
      style={{
        padding: `${spacing.md}px 0`,
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8
      }}
    >
      <span style={{ fontSize: typography.fontSize.md, color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {state.teamAName} {state.score.RED} × {state.score.BLU} {state.teamBName}
      </span>
      <button
        type="button"
        onClick={onWatch}
        style={{
          padding: "4px 12px",
          background: colors.primary,
          border: "none",
          borderRadius: radii.md,
          color: "#fff",
          fontSize: typography.fontSize.sm,
          cursor: "pointer",
          flexShrink: 0
        }}
      >
        Assistir
      </button>
    </li>
  );
};

const CardTitle = ({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string;
}) => (
  <div style={{ marginBottom: spacing.md }}>
    <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.text }}>
      {title}
    </h3>
    {subtitle && (
      <p style={{ margin: "4px 0 0", fontSize: typography.fontSize.sm, color: colors.textMuted }}>
        {subtitle}
      </p>
    )}
  </div>
);

/** Gráfico X-Y: X = partidas jogadas, Y = saldo (vitórias - derrotas). Verde se positivo, vermelho se negativo. */
const WinLossChart = ({
  matches,
  teamId,
  userId,
  wins,
  losses
}: {
  matches: ApiMatch[];
  teamId: string | null;
  userId?: string;
  wins: number;
  losses: number;
}) => {
  const sorted = [...matches].sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  const total = sorted.length;
  const hasRecord = wins + losses > 0;

  const getMyTeamId = (m: ApiMatch) =>
    teamId ?? (m.teamA?.userId === userId ? m.teamAId : m.teamBId);

  // Pontos: (partida, saldo acumulado)
  const balancePoints: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  let balance = 0;
  for (let i = 0; i < sorted.length; i++) {
    const won = sorted[i].winnerId === getMyTeamId(sorted[i]);
    balance += won ? 1 : -1;
    balancePoints.push({ x: i + 1, y: balance });
  }
  const finalBalance = balance;
  const lineColor = finalBalance >= 0 ? colors.success : colors.error;

  const chartW = 260;
  const chartH = 140;
  const pad = { left: 36, right: 12, top: 12, bottom: 28 };
  const plotW = chartW - pad.left - pad.right;
  const plotH = chartH - pad.top - pad.bottom;

  const balances = balancePoints.map((p) => p.y);
  const minY = Math.min(0, ...balances);
  const maxY = Math.max(0, ...balances);
  const rangeY = maxY - minY || 1;

  const toSvg = (p: { x: number; y: number }[]) =>
    p
      .map((pt, i) => {
        const x = pad.left + (pt.x / Math.max(1, total)) * plotW;
        const y = pad.top + plotH - ((pt.y - minY) / rangeY) * plotH;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  const balancePath = toSvg(balancePoints);

  // Fallback: barras horizontais quando temos record mas sem histórico de partidas
  const showFallbackBars = total === 0 && hasRecord;
  const fallbackTotal = wins + losses;
  const winPct = fallbackTotal > 0 ? wins / fallbackTotal : 0;
  const lossPct = fallbackTotal > 0 ? losses / fallbackTotal : 0;
  const barWidth = 160;
  const barHeight = 24;

  return (
    <div
      style={{
        ...cardStyle,
        flex: 1,
        minWidth: 280,
        maxWidth: 360,
        display: "flex",
        flexDirection: "column"
      }}
    >
      <h4 style={{ margin: "0 0 12px", fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.text }}>
        Saldo (V – D)
      </h4>
      {total === 0 && !hasRecord ? (
        <div style={{ color: colors.textDim, fontSize: typography.fontSize.sm }}>
          Nenhuma partida jogada.
        </div>
      ) : showFallbackBars ? (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textMuted, minWidth: 56 }}>Vitórias</span>
            <div style={{ width: barWidth, height: barHeight, background: colors.bgInput, borderRadius: radii.sm, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${winPct * 100}%`, minWidth: wins > 0 ? 6 : 0, height: "100%", background: colors.success, borderRadius: radii.sm }} />
            </div>
            <span style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: colors.success, minWidth: 20 }}>{wins}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textMuted, minWidth: 56 }}>Derrotas</span>
            <div style={{ width: barWidth, height: barHeight, background: colors.bgInput, borderRadius: radii.sm, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${lossPct * 100}%`, minWidth: losses > 0 ? 6 : 0, height: "100%", background: colors.error, borderRadius: radii.sm }} />
            </div>
            <span style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: colors.error, minWidth: 20 }}>{losses}</span>
          </div>
          <div style={{ marginTop: spacing.sm, fontSize: typography.fontSize.sm, color: colors.textDim }}>
            Saldo: <span style={{ fontWeight: typography.fontWeight.bold, color: wins - losses >= 0 ? colors.success : colors.error }}>{wins - losses}</span>
            {" · "}{fallbackTotal} partida{fallbackTotal !== 1 ? "s" : ""} (registro do time)
          </div>
        </div>
      ) : total > 0 ? (
        <>
          <svg width={chartW} height={chartH} style={{ display: "block" }}>
            {/* Linha de saldo zero */}
            <line
              x1={pad.left}
              y1={pad.top + plotH - ((0 - minY) / rangeY) * plotH}
              x2={pad.left + plotW}
              y2={pad.top + plotH - ((0 - minY) / rangeY) * plotH}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3,2"
            />
            {/* Linha do saldo */}
            <path d={balancePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {/* Eixo X: partidas jogadas */}
            {[1, Math.ceil(total / 2), total].filter((v) => v >= 1 && v <= total).map((v) => (
              <text
                key={v}
                x={pad.left + (v / total) * plotW}
                y={chartH - 6}
                textAnchor="middle"
                fontSize={10}
                fill={colors.textMuted}
              >
                {v}
              </text>
            ))}
            {/* Eixo Y: saldo */}
            {Array.from(new Set([minY, 0, maxY].filter((v) => v >= minY && v <= maxY)))
              .sort((a, b) => a - b)
              .map((v) => (
                <text
                  key={v}
                  x={pad.left - 6}
                  y={pad.top + plotH - ((v - minY) / rangeY) * plotH + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill={colors.textMuted}
                >
                  {v}
                </text>
              ))}
          </svg>
          <div style={{ display: "flex", gap: spacing.lg, marginTop: spacing.sm, fontSize: typography.fontSize.sm }}>
            <span style={{ color: lineColor, fontWeight: typography.fontWeight.bold }}>
              Saldo: {finalBalance >= 0 ? "+" : ""}{finalBalance}
            </span>
            <span style={{ color: colors.textDim }}>• {total} partida{total !== 1 ? "s" : ""}</span>
          </div>
        </>
      ) : null}
    </div>
  );
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const { team, teamId } = useUserTeam();
  const { walletBalance } = useMarket();
  const [season, setSeason] = useState<{ id: string; name: string; status: string } | null>(null);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [scheduledMatches, setScheduledMatches] = useState<ApiMatch[]>([]);
  const [ranking, setRanking] = useState<ApiRankingItem[]>([]);
  const [playerRanking, setPlayerRanking] = useState<ApiPlayerRankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSeason(null);
      setMatches([]);
      setScheduledMatches([]);
      setRanking([]);
      setPlayerRanking([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      simulationApi.getSeason(),
      simulationApi.getMatches("finished"),
      simulationApi.getMatches("scheduled"),
      simulationApi.getRanking(),
      simulationApi.getPlayerRanking()
    ])
      .then(([s, finished, scheduled, rank, playerRank]) => {
        if (!cancelled) {
          setSeason(s);
          setMatches(finished);
          setScheduledMatches(scheduled);
          setRanking(rank);
          setPlayerRanking(playerRank);
        }
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const displayName = user?.name ?? "Visitante";
  const displayTeam = team?.name ?? "-";
  const displayBalance = user ? walletBalance : 1000;

  // Histórico: filtra por teamId; se null (ex: fallback localStorage), usa userId do time
  const matchHistory = teamId
    ? matches.filter((m) => m.teamAId === teamId || m.teamBId === teamId)
    : user?.id
      ? matches.filter((m) => m.teamA?.userId === user.id || m.teamB?.userId === user.id)
      : [];

  const starters = team?.starters ?? [];
  const wins = team?.record.wins ?? 0;
  const losses = team?.record.losses ?? 0;

  const playerStatsMap = new Map<string, { kills: number; deaths: number; assists: number }>();
  for (const m of matchHistory) {
    const stats = m.playerStats;
    if (stats) {
      for (const s of stats) {
        const prev = playerStatsMap.get(s.playerId) ?? { kills: 0, deaths: 0, assists: 0 };
        playerStatsMap.set(s.playerId, {
          kills: prev.kills + s.kills,
          deaths: prev.deaths + s.deaths,
          assists: prev.assists + s.assists
        });
      }
    }
  }

  const myTeamRank = teamId ? ranking.findIndex((r) => r.teamId === teamId) : -1;

  return (
    <section>
      <header style={{ marginBottom: spacing["2xl"] }}>
        <h2 style={{ marginTop: 0, marginBottom: spacing.sm, fontSize: typography.fontSize["2xl"], fontWeight: typography.fontWeight.bold, color: colors.text }}>
          Dashboard
        </h2>
        <p style={{ color: colors.textMuted, margin: 0, fontSize: typography.fontSize.md }}>
          Resumo da sua conta, campeonato e desempenho do time.
        </p>
      </header>

      {/* Card do time + gráfico V/D */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing.lg,
          marginBottom: spacing["3xl"],
          alignItems: "stretch"
        }}
      >
        <TeamCard
          teamName={displayTeam}
          starters={starters}
          wins={wins}
          losses={losses}
          points={myTeamRank >= 0 ? ranking[myTeamRank]?.points ?? 0 : 0}
          position={myTeamRank >= 0 ? myTeamRank : undefined}
          managerName={user ? displayName : undefined}
          balance={user ? displayBalance : undefined}
        />
        <WinLossChart matches={matchHistory} teamId={teamId ?? null} userId={user?.id} wins={wins} losses={losses} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: spacing["2xl"]
        }}
      >
        {/* Partidas em andamento */}
        <ActiveMatchesCard />

        {/* Últimas partidas */}
        <div style={cardStyle}>
          <CardTitle title="Últimas partidas" subtitle="Histórico do seu time" />
          {loading ? (
            <div style={{ padding: spacing["2xl"], color: colors.textDim, textAlign: "center" }}>
              Carregando...
            </div>
          ) : matchHistory.length === 0 ? (
            <div style={{ padding: spacing["2xl"], color: colors.textDim, textAlign: "center" }}>
              {user ? "Nenhuma partida jogada ainda." : "Faça login para ver o histórico."}
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {matchHistory.slice(0, 5).map((m) => {
                const myTeamId = teamId ?? (m.teamA?.userId === user?.id ? m.teamAId : m.teamBId);
                const won = m.winnerId === myTeamId;
                const teamAName = m.teamA?.name ?? "Time A";
                const teamBName = m.teamB?.name ?? "Time B";
                return (
                  <li
                    key={m.id}
                    style={{
                      padding: `${spacing.md}px 0`,
                      borderBottom: `1px solid ${colors.border}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <span style={{ fontSize: typography.fontSize.md, color: colors.textMuted }}>
                      {teamAName} {m.scoreA} × {m.scoreB} {teamBName}
                    </span>
                    <span
                      style={{
                        fontWeight: typography.fontWeight.semibold,
                        color: won ? colors.success : colors.error
                      }}
                    >
                      {won ? "Vitória" : "Derrota"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Ranking do campeonato */}
        <div style={cardStyle}>
          <CardTitle title="Classificação" subtitle={season?.name ?? "Liga"} />
          {loading ? (
            <div style={{ padding: spacing["2xl"], color: colors.textDim, textAlign: "center" }}>
              Carregando...
            </div>
          ) : ranking.length === 0 ? (
            <div style={{ padding: spacing["2xl"], color: colors.textDim, textAlign: "center" }}>
              Jogue partidas para ver a tabela.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {ranking.slice(0, 6).map((item, i) => (
                <li
                  key={item.teamId}
                  style={{
                    padding: `${spacing.sm}px 0`,
                    borderBottom: i < 5 ? `1px solid ${colors.border}` : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: spacing.md
                  }}
                >
                  <span style={{ fontWeight: typography.fontWeight.bold, color: colors.textMuted, minWidth: 20 }}>
                    #{i + 1}
                  </span>
                  <span style={{ flex: 1, fontWeight: item.teamId === teamId ? typography.fontWeight.semibold : typography.fontWeight.medium }}>
                    {item.teamName}
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: typography.fontSize.sm }}>
                    {item.points} pts · {item.wins}V-{item.losses}D
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Partidas agendadas */}
      {scheduledMatches.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: spacing["2xl"] }}>
          <CardTitle title="Próximas partidas" subtitle={`${scheduledMatches.length} agendada(s)`} />
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {scheduledMatches.slice(0, 3).map((m) => {
              const teamAName = m.teamA?.name ?? "Time A";
              const teamBName = m.teamB?.name ?? "Time B";
              return (
                <li
                  key={m.id}
                  style={{
                    padding: `${spacing.md}px 0`,
                    borderBottom: `1px solid ${colors.border}`,
                    color: colors.textMuted,
                    fontSize: typography.fontSize.md
                  }}
                >
                  Round {m.round}: {teamAName} vs {teamBName}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Top jogadores da liga */}
      <div style={{ ...cardStyle, marginBottom: spacing["2xl"] }}>
        <CardTitle title="Top jogadores" subtitle="K/D/A da temporada" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.bgInput, borderBottom: `1px solid ${colors.border}` }}>
                <th style={{ padding: `${spacing.sm}px ${spacing.lg}`, textAlign: "left", fontSize: typography.fontSize.sm, color: colors.textDim, fontWeight: typography.fontWeight.semibold }}>#</th>
                <th style={{ padding: `${spacing.sm}px ${spacing.lg}`, textAlign: "left", fontSize: typography.fontSize.sm, color: colors.textDim, fontWeight: typography.fontWeight.semibold }}>Jogador</th>
                <th style={{ padding: `${spacing.sm}px ${spacing.lg}`, textAlign: "left", fontSize: typography.fontSize.sm, color: colors.textDim, fontWeight: typography.fontWeight.semibold }}>Time</th>
                <th style={{ padding: `${spacing.sm}px ${spacing.lg}`, textAlign: "right", fontSize: typography.fontSize.sm, color: colors.textDim, fontWeight: typography.fontWeight.semibold }}>K / D / A</th>
              </tr>
            </thead>
            <tbody>
              {playerRanking.slice(0, 10).map((item, i) => (
                <tr key={item.playerId} style={{ borderBottom: i < 9 ? `1px solid ${colors.border}` : "none" }}>
                  <td style={{ padding: `${spacing.md}px ${spacing.lg}`, color: colors.textDim }}>{i + 1}</td>
                  <td style={{ padding: `${spacing.md}px ${spacing.lg}`, fontWeight: typography.fontWeight.semibold }}>{item.playerName}</td>
                  <td style={{ padding: `${spacing.md}px ${spacing.lg}`, color: colors.textMuted }}>{item.teamName}</td>
                  <td style={{ padding: `${spacing.md}px ${spacing.lg}`, textAlign: "right" }}>
                    <span style={{ color: colors.success }}>{item.kills}</span>
                    <span style={{ color: colors.textDim, margin: "0 4px" }}>/</span>
                    <span style={{ color: colors.error }}>{item.deaths}</span>
                    <span style={{ color: colors.textDim, margin: "0 4px" }}>/</span>
                    <span style={{ color: colors.primaryLight }}>{item.assists}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {playerRanking.length === 0 && !loading && (
            <div style={{ padding: spacing["2xl"], color: colors.textDim, textAlign: "center" }}>
              Jogue partidas para ver o ranking.
            </div>
          )}
        </div>
      </div>

      {/* Estatísticas do seu time */}
      <div style={cardStyle}>
        <CardTitle title="Desempenho do time" subtitle="Jogadores titulares (K/D/A)" />
        <div style={{ display: "flex", gap: spacing["2xl"], marginBottom: spacing.lg }}>
          <div>
            <span style={{ fontSize: typography.fontSize["2xl"], fontWeight: typography.fontWeight.bold, color: colors.success }}>{wins}</span>
            <span style={{ marginLeft: spacing.xs, color: colors.textMuted }}>vitórias</span>
          </div>
          <div>
            <span style={{ fontSize: typography.fontSize["2xl"], fontWeight: typography.fontWeight.bold, color: colors.error }}>{losses}</span>
            <span style={{ marginLeft: spacing.xs, color: colors.textMuted }}>derrotas</span>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.bgInput, borderBottom: `1px solid ${colors.border}` }}>
                <th style={{ padding: `${spacing.sm}px ${spacing.lg}`, textAlign: "left", fontSize: typography.fontSize.sm, color: colors.textDim, fontWeight: typography.fontWeight.semibold }}>Jogador</th>
                <th style={{ padding: `${spacing.sm}px ${spacing.lg}`, textAlign: "left", fontSize: typography.fontSize.sm, color: colors.textDim, fontWeight: typography.fontWeight.semibold }}>Função</th>
                <th style={{ padding: `${spacing.sm}px ${spacing.lg}`, textAlign: "right", fontSize: typography.fontSize.sm, color: colors.textDim, fontWeight: typography.fontWeight.semibold }}>K</th>
                <th style={{ padding: `${spacing.sm}px ${spacing.lg}`, textAlign: "right", fontSize: typography.fontSize.sm, color: colors.textDim, fontWeight: typography.fontWeight.semibold }}>D</th>
                <th style={{ padding: `${spacing.sm}px ${spacing.lg}`, textAlign: "right", fontSize: typography.fontSize.sm, color: colors.textDim, fontWeight: typography.fontWeight.semibold }}>A</th>
              </tr>
            </thead>
            <tbody>
              {starters.map((p) => {
                const stats = playerStatsMap.get(p.id) ?? {
                  kills: p.kills ?? 0,
                  deaths: p.deaths ?? 0,
                  assists: p.assists ?? 0
                };
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: `${spacing.md}px ${spacing.lg}`, fontWeight: typography.fontWeight.medium }}>{p.name}</td>
                    <td style={{ padding: `${spacing.md}px ${spacing.lg}`, color: colors.textMuted }}>{p.role}</td>
                    <td style={{ padding: `${spacing.md}px ${spacing.lg}`, textAlign: "right", color: colors.success }}>{stats.kills}</td>
                    <td style={{ padding: `${spacing.md}px ${spacing.lg}`, textAlign: "right", color: colors.error }}>{stats.deaths}</td>
                    <td style={{ padding: `${spacing.md}px ${spacing.lg}`, textAlign: "right", color: colors.primaryLight }}>{stats.assists}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {starters.length === 0 && (
            <div style={{ padding: spacing["2xl"], color: colors.textDim, textAlign: "center" }}>
              Nenhum jogador no time. Monte seu time em Meu time.
            </div>
          )}
        </div>
      </div>

      {/* Notícias (placeholder) */}
      <div style={{ ...cardStyle, marginTop: spacing["2xl"] }}>
        <CardTitle title="Notícias" subtitle="Em breve" />
        <div style={{ padding: spacing["2xl"], color: colors.textDim, textAlign: "center", fontSize: typography.fontSize.md }}>
          Novidades sobre campeonatos, transferências e atualizações do jogo em breve.
        </div>
      </div>
    </section>
  );
};
