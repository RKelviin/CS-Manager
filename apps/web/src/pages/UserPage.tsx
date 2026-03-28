import { useState, useEffect, type CSSProperties } from "react";
import { useAuth } from "../features/auth";
import { useUserTeam, EditTeamModal } from "../features/team";
import { rankingApi, simulationApi } from "../shared/apiClient";
import type { ApiMatch, ApiTeamRatingHistoryResponse } from "../shared/apiClient";
import { theme } from "../theme";

const { colors, spacing, radii, typography } = theme;

/** Mesma lógica de `getTier` em `rating.service.ts` (servidor). */
function getTier(rating: number): string {
  if (rating < 1000) return "Bronze";
  if (rating < 1500) return "Prata";
  if (rating < 2000) return "Ouro";
  if (rating < 2500) return "Platina";
  if (rating < 3000) return "Diamante";
  return "Lendário";
}

function tierBadgeColor(tier: string): string {
  switch (tier) {
    case "Bronze":
      return colors.textMuted;
    case "Prata":
      return colors.textSecondary;
    case "Ouro":
      return colors.gold;
    case "Platina":
      return colors.primaryLight;
    case "Diamante":
      return colors.accent;
    case "Lendário":
      return colors.warning;
    default:
      return colors.textMuted;
  }
}

const logoutButtonStyle: CSSProperties = {
  padding: `${spacing.md}px ${spacing.xl}px`,
  border: `1px solid ${colors.borderStrong}`,
  background: "transparent",
  color: colors.textMuted,
  borderRadius: radii.md,
  fontSize: typography.fontSize.md,
  cursor: "pointer"
};

const editTeamButtonStyle: CSSProperties = {
  ...logoutButtonStyle,
  border: `1px solid ${colors.primary}`,
  color: colors.primary
};

export const UserPage = () => {
  const { user, logout } = useAuth();
  const {
    team,
    teamId,
    swapPlayers,
    updateTeamName,
    updateTeamRecord,
    updatePlayer
  } = useUserTeam();

  const [history, setHistory] = useState<ApiTeamRatingHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [season, setSeason] = useState<{ id: string; name: string; status: string } | null>(null);
  const [finishedMatches, setFinishedMatches] = useState<ApiMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setHistory(null);
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    rankingApi
      .getTeamHistory(teamId)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory(null);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    if (!user) {
      setSeason(null);
      setFinishedMatches([]);
      setMatchesLoading(false);
      return;
    }
    let cancelled = false;
    setMatchesLoading(true);
    Promise.all([simulationApi.getSeason(), simulationApi.getMatches("finished")])
      .then(([s, matches]) => {
        if (!cancelled) {
          setSeason(s);
          setFinishedMatches(matches);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSeason(null);
          setFinishedMatches([]);
        }
      })
      .finally(() => {
        if (!cancelled) setMatchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <section>
        <p style={{ color: colors.textMuted }}>Faça login para acessar seu perfil.</p>
      </section>
    );
  }

  const cardStyle: CSSProperties = {
    background: colors.bgElevated,
    padding: spacing["2xl"],
    borderRadius: radii.xl,
    border: `1px solid ${colors.border}`,
    marginBottom: spacing.lg
  };

  const wins = team.record.wins;
  const losses = team.record.losses;

  const matchHistory =
    season == null
      ? []
      : teamId
        ? finishedMatches.filter(
            (m) =>
              m.seasonId === season.id && (m.teamAId === teamId || m.teamBId === teamId)
          )
        : user.id
          ? finishedMatches.filter(
              (m) =>
                m.seasonId === season.id &&
                (m.teamA?.userId === user.id || m.teamB?.userId === user.id)
            )
          : [];

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

  const rosterIds = [...team.starters, ...team.bench].map((p) => p.id);
  let teamKills = 0;
  let teamDeaths = 0;
  let teamAssists = 0;
  for (const id of rosterIds) {
    const s = playerStatsMap.get(id);
    if (s) {
      teamKills += s.kills;
      teamDeaths += s.deaths;
      teamAssists += s.assists;
    }
  }

  const starters = team.starters;

  return (
    <section style={{ maxWidth: 480 }}>
      <h2 style={{ marginTop: 0, marginBottom: spacing.sm }}>Meu perfil</h2>
      <p
        style={{
          color: colors.textMuted,
          marginBottom: spacing["2xl"],
          fontSize: typography.fontSize.md
        }}
      >
        Dados da sua conta e saldo disponível.
      </p>

      {/* Card: Conta */}
      <div style={cardStyle}>
        <div style={{ marginBottom: spacing.lg }}>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textDim,
              marginBottom: spacing.xs
            }}
          >
            Nome
          </div>
          <div style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold }}>
            {user.name}
          </div>
        </div>
        <div style={{ marginBottom: spacing.lg }}>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textDim,
              marginBottom: spacing.xs
            }}
          >
            Email
          </div>
          <div style={{ fontSize: typography.fontSize.md }}>{user.email}</div>
        </div>
        <div style={{ marginBottom: spacing.lg }}>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textDim,
              marginBottom: spacing.xs
            }}
          >
            Saldo
          </div>
          <div style={{ fontSize: typography.fontSize["3xl"], fontWeight: typography.fontWeight.bold, color: colors.gold }}>
            ${user.walletBalance.toLocaleString("pt-BR")}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.md }}>
          <button type="button" onClick={() => setShowEditTeam(true)} style={editTeamButtonStyle}>
            Editar time
          </button>
          <button type="button" onClick={logout} style={logoutButtonStyle}>
            Sair
          </button>
        </div>
      </div>

      {/* Card: Rating e Tier */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textDim,
            marginBottom: spacing.sm
          }}
        >
          Rating atual
        </div>
        {historyLoading ? (
          <div style={{ color: colors.textDim }}>Carregando...</div>
        ) : history ? (
          <div style={{ display: "flex", alignItems: "center", gap: spacing.md, flexWrap: "wrap" }}>
            <span style={{ fontSize: typography.fontSize["3xl"], fontWeight: typography.fontWeight.bold, color: colors.text }}>
              {history.currentRating}
            </span>
            <span
              style={{
                padding: `${spacing.xs}px ${spacing.md}px`,
                borderRadius: radii.md,
                border: `1px solid ${tierBadgeColor(getTier(history.currentRating))}`,
                color: tierBadgeColor(getTier(history.currentRating)),
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold
              }}
            >
              {getTier(history.currentRating)}
            </span>
          </div>
        ) : (
          <div style={{ color: colors.textDim }}>—</div>
        )}
      </div>

      {/* Card: Estatísticas V/D */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textDim,
            marginBottom: spacing.md
          }}
        >
          Estatísticas da temporada
        </div>
        <div style={{ display: "flex", gap: spacing["2xl"] }}>
          <div>
            <span style={{ fontSize: typography.fontSize["2xl"], fontWeight: typography.fontWeight.bold, color: colors.success }}>
              {wins}
            </span>
            <span style={{ marginLeft: spacing.xs, color: colors.textMuted }}>vitórias</span>
          </div>
          <div>
            <span style={{ fontSize: typography.fontSize["2xl"], fontWeight: typography.fontWeight.bold, color: colors.error }}>
              {losses}
            </span>
            <span style={{ marginLeft: spacing.xs, color: colors.textMuted }}>derrotas</span>
          </div>
        </div>
      </div>

      {/* Card: K/D/A da temporada */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textDim,
            marginBottom: spacing.md
          }}
        >
          K/D/A da temporada
          {season ? (
            <span style={{ color: colors.textMuted, fontWeight: typography.fontWeight.normal }}>
              {" "}
              · {season.name}
            </span>
          ) : null}
        </div>
        {matchesLoading ? (
          <div style={{ color: colors.textDim }}>Carregando...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: spacing["2xl"], flexWrap: "wrap", marginBottom: spacing.lg }}>
              <div>
                <span
                  style={{
                    fontSize: typography.fontSize["2xl"],
                    fontWeight: typography.fontWeight.bold,
                    color: colors.success
                  }}
                >
                  {teamKills}
                </span>
                <span style={{ marginLeft: spacing.xs, color: colors.textMuted }}>abates</span>
              </div>
              <div>
                <span
                  style={{
                    fontSize: typography.fontSize["2xl"],
                    fontWeight: typography.fontWeight.bold,
                    color: colors.error
                  }}
                >
                  {teamDeaths}
                </span>
                <span style={{ marginLeft: spacing.xs, color: colors.textMuted }}>mortes</span>
              </div>
              <div>
                <span
                  style={{
                    fontSize: typography.fontSize["2xl"],
                    fontWeight: typography.fontWeight.bold,
                    color: colors.primaryLight
                  }}
                >
                  {teamAssists}
                </span>
                <span style={{ marginLeft: spacing.xs, color: colors.textMuted }}>assistências</span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: colors.bgInput, borderBottom: `1px solid ${colors.border}` }}>
                    <th
                      style={{
                        padding: `${spacing.sm}px ${spacing.lg}`,
                        textAlign: "left",
                        fontSize: typography.fontSize.sm,
                        color: colors.textDim,
                        fontWeight: typography.fontWeight.semibold
                      }}
                    >
                      Jogador
                    </th>
                    <th
                      style={{
                        padding: `${spacing.sm}px ${spacing.lg}`,
                        textAlign: "left",
                        fontSize: typography.fontSize.sm,
                        color: colors.textDim,
                        fontWeight: typography.fontWeight.semibold
                      }}
                    >
                      Função
                    </th>
                    <th
                      style={{
                        padding: `${spacing.sm}px ${spacing.lg}`,
                        textAlign: "right",
                        fontSize: typography.fontSize.sm,
                        color: colors.textDim,
                        fontWeight: typography.fontWeight.semibold
                      }}
                    >
                      K
                    </th>
                    <th
                      style={{
                        padding: `${spacing.sm}px ${spacing.lg}`,
                        textAlign: "right",
                        fontSize: typography.fontSize.sm,
                        color: colors.textDim,
                        fontWeight: typography.fontWeight.semibold
                      }}
                    >
                      D
                    </th>
                    <th
                      style={{
                        padding: `${spacing.sm}px ${spacing.lg}`,
                        textAlign: "right",
                        fontSize: typography.fontSize.sm,
                        color: colors.textDim,
                        fontWeight: typography.fontWeight.semibold
                      }}
                    >
                      A
                    </th>
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
                        <td style={{ padding: `${spacing.md}px ${spacing.lg}`, fontWeight: typography.fontWeight.medium }}>
                          {p.name}
                        </td>
                        <td style={{ padding: `${spacing.md}px ${spacing.lg}`, color: colors.textMuted }}>{p.role}</td>
                        <td style={{ padding: `${spacing.md}px ${spacing.lg}`, textAlign: "right", color: colors.success }}>
                          {stats.kills}
                        </td>
                        <td style={{ padding: `${spacing.md}px ${spacing.lg}`, textAlign: "right", color: colors.error }}>
                          {stats.deaths}
                        </td>
                        <td style={{ padding: `${spacing.md}px ${spacing.lg}`, textAlign: "right", color: colors.primaryLight }}>
                          {stats.assists}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {starters.length === 0 && (
                <div style={{ padding: spacing.lg, color: colors.textDim, textAlign: "center" }}>
                  Nenhum jogador titular. Monte seu time em Editar time.
                </div>
              )}
              {starters.length > 0 && matchHistory.length === 0 && !matchesLoading && (
                <div style={{ padding: spacing.md, color: colors.textDim, fontSize: typography.fontSize.sm }}>
                  Nenhuma partida finalizada na temporada com estatísticas ainda.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Card: Histórico Elo */}
      <div style={{ ...cardStyle, marginBottom: 0 }}>
        <div
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textDim,
            marginBottom: spacing.md
          }}
        >
          Histórico Elo (últimas partidas ranqueadas)
        </div>
        {historyLoading ? (
          <div style={{ color: colors.textDim }}>Carregando...</div>
        ) : !history || history.history.length === 0 ? (
          <div style={{ color: colors.textDim }}>Nenhuma partida ranqueada ainda.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: colors.bgInput, borderBottom: `1px solid ${colors.border}` }}>
                  <th
                    style={{
                      padding: `${spacing.sm}px ${spacing.lg}`,
                      textAlign: "left",
                      fontSize: typography.fontSize.sm,
                      color: colors.textDim,
                      fontWeight: typography.fontWeight.semibold
                    }}
                  >
                    Adversário
                  </th>
                  <th
                    style={{
                      padding: `${spacing.sm}px ${spacing.lg}`,
                      textAlign: "left",
                      fontSize: typography.fontSize.sm,
                      color: colors.textDim,
                      fontWeight: typography.fontWeight.semibold
                    }}
                  >
                    Resultado
                  </th>
                  <th
                    style={{
                      padding: `${spacing.sm}px ${spacing.lg}`,
                      textAlign: "right",
                      fontSize: typography.fontSize.sm,
                      color: colors.textDim,
                      fontWeight: typography.fontWeight.semibold
                    }}
                  >
                    Δ Rating
                  </th>
                  <th
                    style={{
                      padding: `${spacing.sm}px ${spacing.lg}`,
                      textAlign: "right",
                      fontSize: typography.fontSize.sm,
                      color: colors.textDim,
                      fontWeight: typography.fontWeight.semibold
                    }}
                  >
                    Rating após
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.history.slice(0, 10).map((row) => {
                  const resultLabel = row.result === "win" ? "V" : row.result === "draw" ? "E" : "D";
                  const resultColor =
                    row.result === "win" ? colors.success : row.result === "draw" ? colors.textDim : colors.error;
                  const deltaStr =
                    row.ratingDelta > 0 ? `+${row.ratingDelta}` : String(row.ratingDelta);
                  const deltaColor = row.ratingDelta > 0 ? colors.success : row.ratingDelta < 0 ? colors.error : colors.textDim;
                  return (
                    <tr key={row.matchId} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: `${spacing.md}px ${spacing.lg}`, color: colors.textMuted }}>{row.opponentName}</td>
                      <td style={{ padding: `${spacing.md}px ${spacing.lg}`, color: resultColor, fontWeight: typography.fontWeight.medium }}>
                        {resultLabel}
                      </td>
                      <td style={{ padding: `${spacing.md}px ${spacing.lg}`, textAlign: "right", color: deltaColor }}>{deltaStr}</td>
                      <td style={{ padding: `${spacing.md}px ${spacing.lg}`, textAlign: "right", color: colors.text }}>
                        {row.ratingAfter}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditTeam && (
        <EditTeamModal
          team={team}
          onSwap={swapPlayers}
          onUpdateTeamName={updateTeamName}
          onUpdateTeamRecord={updateTeamRecord}
          onUpdatePlayer={updatePlayer}
          onClose={() => setShowEditTeam(false)}
        />
      )}
    </section>
  );
};
