import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../features/auth";
import { useUserTeam } from "../features/team";
import { useMatch, useMatchContext, matchRegistry, type MatchSetup, type MatchState } from "../features/replay";
import { DUST2_MAP } from "../features/replay/map/dust2Map";
import { theme } from "../theme";
import { userTeamToMatchSetup } from "../features/replay/utils/userTeamToMatchSetup";
import { teamsToMatchSetup } from "../features/replay/utils/teamsToMatchSetup";
import { getAllMaps, getBuiltinMaps, getMap, getMapSync } from "../features/replay/map/mapRegistry";
import type { MapInfo } from "../features/replay/map/mapRegistry";
import type { ApiMatch, PersistMatchResultResponse } from "../shared/apiClient";
import { simulationApi } from "../shared/apiClient";
import {
  ActiveMatchesBar,
  GameCanvas,
  MatchControls,
  MatchEndOverlay,
  MatchHUD,
  MatchLogs,
  RoundEndBanner,
  TeamPanel
} from "../features/replay/ui";
import { ErrorBoundary } from "../components/ErrorBoundary";

const { colors, radii, typography } = theme;

/** Rótulo estável do mapa para comparar setup ↔ estado no registry */
const mapLabelFromSetup = (s: MatchSetup) => s.mapData?.name ?? DUST2_MAP.name;

const mapLabelFromState = (st: MatchState) => st.mapData?.name ?? DUST2_MAP.name;

/** Estado no registry ainda corresponde ao setup (mapa + times)? */
const registryStateMatchesSetup = (st: MatchState, setup: MatchSetup): boolean =>
  mapLabelFromState(st) === mapLabelFromSetup(setup) &&
  st.teamAName === setup.teamAName &&
  st.teamBName === setup.teamBName;

/**
 * Escolhe um ID cuja partida ainda existe no registry (evita ID obsoleto no contexto
 * após troca de mapa / removeMatch).
 */
const pickLiveMatchId = (
  propId: string | null | undefined,
  watchedId: string | null | undefined,
  createdId: string | null
): string | null => {
  for (const id of [propId, watchedId, createdId]) {
    if (id && matchRegistry.getMatch(id)) return id;
  }
  return null;
};

export const SimulationPage = () => {
  const { user, fetchMe } = useAuth();
  const { team, teamId, refreshTeam } = useUserTeam();
  const matchContext = useMatchContext();
  const [leagueMatch, setLeagueMatch] = useState<ApiMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapId, setMapId] = useState("dust2");
  const [maps, setMaps] = useState<MapInfo[]>(() => getBuiltinMaps());
  const [mapData, setMapData] = useState<import("../features/replay/map/mapTypes").MapData | null>(null);

  useEffect(() => {
    getAllMaps().then((list) => setMaps(list.length > 0 ? list : getBuiltinMaps()));
  }, []);

  useEffect(() => {
    if (mapId === "dust2") {
      setMapData(null);
      return;
    }
    let cancelled = false;
    setMapData(null);
    getMap(mapId).then((m) => {
      if (!cancelled) setMapData(m ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  useEffect(() => {
    if (!user) {
      setLeagueMatch(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    simulationApi
      .getMatches("scheduled")
      .then((matches) => {
        if (!cancelled && matches.length > 0) setLeagueMatch(matches[0]);
        else if (!cancelled) setLeagueMatch(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar partidas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    /* user?.id evita refetch quando fetchMe/refreshTeam (após persist) atualizam o objeto user:
       sem isso, a partida recém-finalizada sai de "scheduled" e o refetch zera leagueMatch,
       remontando SimulationView e sumindo a tela de fim de partida. */
  }, [user?.id]);

  const baseSetup = useMemo((): MatchSetup => {
    if (leagueMatch && leagueMatch.teamA.players.length >= 5 && leagueMatch.teamB.players.length >= 5) {
      return teamsToMatchSetup(
        { name: leagueMatch.teamA.name, starters: leagueMatch.teamA.players },
        { name: leagueMatch.teamB.name, starters: leagueMatch.teamB.players }
      );
    }
    const t = team ?? { name: "Meu time", starters: [] };
    return userTeamToMatchSetup(t.name, t.starters ?? []);
  }, [leagueMatch, team?.name, team?.starters]);

  /** Dust2: síncrono. Custom: só usa mapData quando o fetch do mapId atual terminar */
  const effectiveMapData = mapId === "dust2" ? getMapSync("dust2") : mapData;

  /** Custom: mapData precisa ser do mapId atual (evita Dust2 por estado desatualizado) */
  const mapReady = mapId === "dust2" ? true : mapData != null;

  const setup = useMemo(
    (): MatchSetup => ({
      ...baseSetup,
      mapData: effectiveMapData ?? undefined
    }),
    [baseSetup, effectiveMapData]
  );

  if (loading) {
    return (
      <section>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Simulação</h2>
        <p style={{ color: "#94a3b8" }}>Carregando partidas...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Simulação</h2>
        <p style={{ color: "#f87171" }}>{error}</p>
      </section>
    );
  }

  const subtitle = leagueMatch
    ? `Round ${leagueMatch.round}: ${leagueMatch.teamA.name} vs ${leagueMatch.teamB.name}`
    : `${team?.name ?? "Meu time"} vs adversário. Iniciar para rodar a partida.`;

  return (
    <section style={{ position: "relative", width: "100%", maxWidth: "100%", margin: 0 }}>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>Simulação</h2>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
          {subtitle}
        </p>
        {matchContext && (
          <button
            type="button"
            onClick={() => {
              const id = matchContext.startMatch(setup);
              matchRegistry.removeStaleIdleDuplicates(id, setup);
              matchRegistry.removeEndedMatches();
              matchContext.watchMatch(id);
            }}
            style={{
              padding: "6px 14px",
              background: colors.primary,
              border: "none",
              borderRadius: radii.md,
              color: "#fff",
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              cursor: "pointer"
            }}
            title="Nova partida: lobbies idle duplicados (mesmo mapa/times, 0–0 R1 pausado) são removidos"
          >
            + Nova partida
          </button>
        )}
        <ActiveMatchesBar />
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 14 }}>
          Mapa:
          <select
            value={mapId}
            onChange={(e) => setMapId(e.target.value)}
            style={{
              padding: "6px 10px",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 6,
              color: "#eef2ff",
              fontSize: 13
            }}
          >
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!mapReady ? (
        <p style={{ color: "#94a3b8" }}>Carregando mapa...</p>
      ) : (
      <ErrorBoundary>
      <SimulationView
        key={`${leagueMatch?.id ?? "free"}-${mapId}`}
        setup={setup}
        leagueMatch={leagueMatch}
        user={user}
        userTeamId={teamId ?? undefined}
        onLeagueMatchChange={setLeagueMatch}
        onMatchPersisted={() => {
          refreshTeam();
          fetchMe();
        }}
      />
      </ErrorBoundary>
      )}
    </section>
  );
};

export function SimulationView({
  setup,
  leagueMatch,
  user,
  userTeamId,
  onLeagueMatchChange,
  onMatchPersisted,
  onBackToChampionship,
  matchId: matchIdProp,
  onRegistryMatchReplaced
}: {
  setup: MatchSetup;
  leagueMatch: ApiMatch | null;
  user: { id: string } | null;
  userTeamId?: string;
  onLeagueMatchChange: (m: ApiMatch | null) => void;
  onMatchPersisted?: () => void;
  /** Quando em partida de campeonato: callback para voltar à lista do campeonato */
  onBackToChampionship?: () => void;
  /** ID da partida para assistir (registry). Se ausente, cria nova no mount. */
  matchId?: string | null;
  /** Campeonato: atualizar o matchId guardado quando mapa/setup mudar e o registry for recriado */
  onRegistryMatchReplaced?: (newMatchId: string) => void;
}) {
  const persistedRef = useRef(false);
  const [persistResult, setPersistResult] = useState<Pick<PersistMatchResultResponse, "ratingResult" | "teamPositions"> | null>(null);
  const matchContext = useMatchContext();
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);

  const watchedId = matchContext?.watchedMatchId ?? null;
  const liveId = pickLiveMatchId(matchIdProp, watchedId, createdMatchId);
  const matchId = liveId;

  /**
   * Mantém uma partida no registry alinhada ao setup (mapa/times).
   * Antes só criava quando não havia matchId — ao mudar o mapa no select, o ID antigo continuava e o canvas não atualizava.
   */
  useEffect(() => {
    const ctx = matchContext;
    if (!ctx?.startMatch) return;

    const startAndWatch = (removeId: string | null) => {
      if (removeId) ctx.removeMatch(removeId);
      const newId = ctx.startMatch(setup);
      matchRegistry.removeStaleIdleDuplicates(newId, setup);
      matchRegistry.removeEndedMatches();
      ctx.watchMatch(newId);
      setCreatedMatchId(newId);
      onRegistryMatchReplaced?.(newId);
    };

    const currentLive = pickLiveMatchId(matchIdProp, watchedId, createdMatchId);

    if (!currentLive) {
      startAndWatch(null);
      return;
    }

    const existing = matchRegistry.getMatch(currentLive);
    if (!existing || !registryStateMatchesSetup(existing, setup)) {
      startAndWatch(currentLive);
    }
  }, [
    setup,
    matchIdProp,
    createdMatchId,
    watchedId,
    onRegistryMatchReplaced,
    matchContext?.startMatch,
    matchContext?.watchMatch,
    matchContext?.removeMatch
  ]);

  const { state, start, pause, reset, finishRound } = useMatch(matchId);

  const onMatchEndPersist = useCallback(() => {
    if (!state || !leagueMatch || !user || persistedRef.current) return;
    const winner = state.matchWinner;
    if (winner !== "RED" && winner !== "BLU") return;

    const winnerId = winner === "RED" ? leagueMatch.teamAId : leagueMatch.teamBId;
    const scoreA = state.score.RED;
    const scoreB = state.score.BLU;

    const redBots = state.bots.filter((b) => b.team === "RED").sort((a, b) => a.id.localeCompare(b.id));
    const bluBots = state.bots.filter((b) => b.team === "BLU").sort((a, b) => a.id.localeCompare(b.id));
    const teamAPlayers = leagueMatch.teamA.players;
    const teamBPlayers = leagueMatch.teamB.players;

    const playerStats = [
      ...redBots.slice(0, 5).map((b, i) => ({
        playerId: teamAPlayers[i]?.id ?? "",
        kills: b.kills,
        deaths: b.deaths,
        assists: b.assists
      })),
      ...bluBots.slice(0, 5).map((b, i) => ({
        playerId: teamBPlayers[i]?.id ?? "",
        kills: b.kills,
        deaths: b.deaths,
        assists: b.assists
      }))
    ].filter((s) => s.playerId);

    persistedRef.current = true;
    setPersistResult(null);
    simulationApi
      .persistMatchResult(leagueMatch.id, { winnerId, scoreA, scoreB, playerStats })
      .then((res) => {
        setPersistResult({ ratingResult: res.ratingResult, teamPositions: res.teamPositions });
        onMatchPersisted?.();
      })
      .catch(() => {
        persistedRef.current = false;
      });
  }, [state, leagueMatch, user, onMatchPersisted]);

  useEffect(() => {
    if (state && (state.matchWinner || state.matchDraw)) {
      onMatchEndPersist();
    }
  }, [state, state?.matchWinner, state?.matchDraw, onMatchEndPersist]);

  const handleRestart = useCallback(() => {
    persistedRef.current = false;
    setPersistResult(null);
    reset();
  }, [reset]);

  if (!state) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
        {matchId ? "Partida não encontrada ou já encerrada." : "Preparando partida..."}
      </div>
    );
  }

  return (
    <>
      <MatchHUD state={state} />
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "minmax(200px, 1fr) minmax(0, 3.2fr) minmax(200px, 1fr)",
          alignItems: "start"
        }}
      >
        <TeamPanel state={state} side="RED" />
        <div style={{ position: "relative", minWidth: 0, alignSelf: "start" }}>
          <GameCanvas state={state} />
          <RoundEndBanner state={state} />
        </div>
        <TeamPanel state={state} side="BLU" />
      </div>
      <MatchControls
        isRunning={state.isRunning}
        matchEnded={state.matchWinner != null || state.matchDraw}
        canFinishRound={state.pendingRoundAdvance == null}
        onStart={start}
        onPause={pause}
        onReset={handleRestart}
        onFinishRound={finishRound}
      />
      <MatchEndOverlay
        state={state}
        onRestart={handleRestart}
        userWon={
          !!(leagueMatch &&
            userTeamId &&
            state.matchWinner &&
            ((state.matchWinner === "RED" && leagueMatch.teamAId === userTeamId) ||
              (state.matchWinner === "BLU" && leagueMatch.teamBId === userTeamId)))
        }
        ratingResult={persistResult?.ratingResult ?? undefined}
        teamPositions={persistResult?.teamPositions ?? undefined}
        onBackToChampionship={onBackToChampionship}
      />
      <div style={{ marginTop: 12 }}>
        <MatchLogs
          logs={state.logs}
          tickOrderFooter={`Ordem do tick: ${state.round % 2 === 1 ? state.teamAName : state.teamBName} primeiro → alterna a cada round · passos: mira → movimento → tiro`}
        />
      </div>
    </>
  );
}
