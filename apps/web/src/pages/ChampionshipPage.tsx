import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../features/auth";
import { useUserTeam } from "../features/team";
import { championshipApi, simulationApi } from "../shared/apiClient";
import type { ChampionshipTemplate, ChampionshipRun, ApiMatch } from "../shared/apiClient";
import { theme } from "../theme";
import { SimulationView } from "./SimulationPage";
import { matchRegistry, useMatchContext, useMatch, type MatchSetup } from "../features/replay";
import { userTeamToMatchSetup } from "../features/replay/utils/userTeamToMatchSetup";
import { teamsToMatchSetup } from "../features/replay/utils/teamsToMatchSetup";
import { getAllMaps, getBuiltinMaps, getMap, getMapSync } from "../features/replay/map/mapRegistry";
import type { MapInfo } from "../features/replay/map/mapRegistry";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { BracketView } from "../features/championship/BracketView";

const { colors, spacing, radii, typography } = theme;

export const ChampionshipPage = () => {
  const { user } = useAuth();
  const { team, teamId } = useUserTeam();
  const [templates, setTemplates] = useState<ChampionshipTemplate[]>([]);
  const [runs, setRuns] = useState<ChampionshipRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<2 | 4 | 8 | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  /** Partidas do campeonato em andamento: leagueMatchId -> { matchId, apiMatch } */
  const [activeChampionshipMatches, setActiveChampionshipMatches] = useState<
    Map<string, { matchId: string; apiMatch: ApiMatch }>
  >(new Map());
  /** Partida sendo assistida (null = voltar para lista do run) */
  const [watchedLeagueMatchId, setWatchedLeagueMatchId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const matchContext = useMatchContext();
  const [mapId, setMapId] = useState("dust2");
  const [maps, setMaps] = useState<MapInfo[]>(() => getBuiltinMaps());
  const [mapData, setMapData] = useState<import("../features/replay/map/mapTypes").MapData | null>(null);

  useEffect(() => {
    championshipApi.getTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

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
      setRuns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    championshipApi
      .getRuns()
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    setActiveChampionshipMatches(new Map());
    setWatchedLeagueMatchId(null);
  }, [selectedRunId]);

  const handlePlayMatch = useCallback(
    async (m: ApiMatch, mapId: string, mapData: import("../features/replay/map/mapTypes").MapData | null) => {
      const existing = activeChampionshipMatches.get(m.id);
      if (existing) {
        setWatchedLeagueMatchId(m.id);
        return;
      }
      const apiMatch = m.teamA?.players?.length >= 5 && m.teamB?.players?.length >= 5
        ? m
        : await simulationApi.getMatch(m.id);
      const baseSetup: MatchSetup = apiMatch.teamA?.players?.length >= 5 && apiMatch.teamB?.players?.length >= 5
        ? teamsToMatchSetup(
            { name: apiMatch.teamA.name, starters: apiMatch.teamA.players },
            { name: apiMatch.teamB.name, starters: apiMatch.teamB.players }
          )
        : userTeamToMatchSetup(team?.name ?? "Meu time", team?.starters ?? []);
      const setup: MatchSetup = {
        ...baseSetup,
        mapData: mapId === "dust2" ? getMapSync("dust2") ?? undefined : mapData ?? undefined
      };
      if (!matchContext) return;
      const matchId = matchContext.startMatch(setup);
      matchRegistry.removeStaleIdleDuplicates(matchId, setup);
      matchRegistry.removeEndedMatches();
      setActiveChampionshipMatches((prev) => {
        const next = new Map(prev);
        next.set(apiMatch.id, { matchId, apiMatch });
        return next;
      });
      setWatchedLeagueMatchId(apiMatch.id);
    },
    [activeChampionshipMatches, team, matchContext]
  );

  const handleRegistryMatchReplaced = useCallback((newMatchId: string) => {
    setActiveChampionshipMatches((prev) => {
      const next = new Map(prev);
      const key = watchedLeagueMatchId;
      if (!key) return prev;
      const cur = next.get(key);
      if (!cur) return prev;
      next.set(key, { ...cur, matchId: newMatchId });
      return next;
    });
  }, [watchedLeagueMatchId]);

  const handleStart = async (format: 2 | 4 | 8) => {
    if (!user) return;
    setStarting(true);
    setError(null);
    try {
      const res = await championshipApi.start(format);
      setRuns((prev) => [
        { id: res.id, name: res.name, format, status: "active", matchCount: res.matches?.length ?? 0, matches: res.matches ?? [], prizes: templates.find((t) => t.format === format)?.prizes ?? [] },
        ...prev
      ]);
      setSelectedFormat(null);
      setSelectedRunId(res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao iniciar campeonato");
    } finally {
      setStarting(false);
    }
  };

  if (!user) {
    return (
      <section>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Campeonatos</h2>
        <p style={{ color: colors.textMuted }}>Faça login para participar de campeonatos eliminatórios.</p>
      </section>
    );
  }

  if (loading && runs.length === 0) {
    return (
      <section>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Campeonatos</h2>
        <p style={{ color: colors.textMuted }}>Carregando...</p>
      </section>
    );
  }

  const run = selectedRunId ? runs.find((r) => r.id === selectedRunId) : null;

  if (run && watchedLeagueMatchId && matchContext) {
    const entry = activeChampionshipMatches.get(watchedLeagueMatchId);
    const mapReady = mapId === "dust2" ? true : mapData != null;

    if (entry) {
      const baseSetup: MatchSetup = entry.apiMatch.teamA?.players?.length >= 5 && entry.apiMatch.teamB?.players?.length >= 5
        ? teamsToMatchSetup(
            { name: entry.apiMatch.teamA.name, starters: entry.apiMatch.teamA.players },
            { name: entry.apiMatch.teamB.name, starters: entry.apiMatch.teamB.players }
          )
        : userTeamToMatchSetup(team?.name ?? "Meu time", team?.starters ?? []);
      const effectiveMapData = mapId === "dust2" ? getMapSync("dust2") : mapData;
      const setup: MatchSetup = { ...baseSetup, mapData: effectiveMapData ?? undefined };

      return (
        <section>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button
              onClick={() => setWatchedLeagueMatchId(null)}
              style={{
                padding: "8px 16px",
                background: colors.bgInput,
                border: `1px solid ${colors.border}`,
                borderRadius: radii.md,
                color: colors.text,
                cursor: "pointer",
                fontSize: typography.fontSize.sm
              }}
            >
              ← Voltar
            </button>
            <ChampionshipMatchChips
              activeMatches={activeChampionshipMatches}
              watchedId={watchedLeagueMatchId}
              onWatch={(id) => setWatchedLeagueMatchId(id)}
              onRemove={(id) => {
                matchContext.removeMatch(activeChampionshipMatches.get(id)!.matchId);
                setActiveChampionshipMatches((prev) => {
                  const next = new Map(prev);
                  next.delete(id);
                  return next;
                });
                if (watchedLeagueMatchId === id) {
                  const remaining = [...activeChampionshipMatches.keys()].filter((k) => k !== id);
                  setWatchedLeagueMatchId(remaining[0] ?? null);
                }
              }}
            />
            <h2 style={{ margin: 0, fontSize: typography.fontSize.lg }}>
              {entry.apiMatch.teamA.name} vs {entry.apiMatch.teamB.name}
            </h2>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: colors.textMuted, fontSize: 14, marginLeft: "auto" }}>
              Mapa:
              <select
                value={mapId}
                onChange={(e) => setMapId(e.target.value)}
                style={{
                  padding: "6px 10px",
                  background: colors.bgInput,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.md,
                  color: colors.text,
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
            <p style={{ color: colors.textMuted }}>Carregando mapa...</p>
          ) : (
            <>
              <ChampionshipStartMoreBar
                run={run}
                activeMap={activeChampionshipMatches}
                onPlay={(m) => handlePlayMatch(m, mapId, mapData)}
              />
              <ErrorBoundary>
                <SimulationView
                  key={`${entry.apiMatch.id}-${mapId}`}
                  setup={setup}
                  leagueMatch={entry.apiMatch}
                  user={user}
                  userTeamId={teamId ?? undefined}
                  matchId={entry.matchId}
                  onRegistryMatchReplaced={handleRegistryMatchReplaced}
                  onLeagueMatchChange={() => {}}
                  onBackToChampionship={() => setWatchedLeagueMatchId(null)}
                  onMatchPersisted={() => {
                    matchContext.removeMatch(entry.matchId);
                    setActiveChampionshipMatches((prev) => {
                      const next = new Map(prev);
                      next.delete(entry.apiMatch.id);
                      return next;
                    });
                    setWatchedLeagueMatchId((prev) => {
                      const remaining = [...activeChampionshipMatches.keys()].filter((k) => k !== entry.apiMatch.id);
                      return remaining[0] ?? null;
                    });
                    championshipApi.getRuns().then(setRuns);
                  }}
                />
              </ErrorBoundary>
            </>
          )}
        </section>
      );
    }
  }
  const template = selectedFormat ? templates.find((t) => t.format === selectedFormat) : null;

  return (
    <section>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>Campeonatos</h2>
      <p style={{ color: colors.textMuted, marginBottom: 24 }}>
        Copas eliminatórias. Inscreva seu time e dispute contra adversários aleatórios.
      </p>

      {error && (
        <div style={{ padding: 12, background: `${colors.error}22`, borderRadius: 8, color: colors.error, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {selectedRunId && run ? (
        <ChampionshipRunView
          run={run}
          mapId={mapId}
          onMapChange={setMapId}
          maps={maps}
          onBack={() => setSelectedRunId(null)}
          onPlayMatch={(m) => handlePlayMatch(m, mapId, mapData)}
        />
      ) : selectedFormat && template ? (
        <ChampionshipDetailView
          template={template}
          onStart={() => handleStart(selectedFormat)}
          onBack={() => setSelectedFormat(null)}
          starting={starting}
        />
      ) : (
        <>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Formatos disponíveis</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {templates.map((t) => (
              <div
                key={t.format}
                onClick={() => setSelectedFormat(t.format)}
                style={{
                  padding: 16,
                  background: colors.bgInput,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div>
                  <strong style={{ color: colors.text }}>{t.name}</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: colors.textMuted }}>{t.description}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.gold }}>
                    Premiação: {t.prizes.map((p, i) => `${["1º", "2º", "3º", "4º"][i] ?? ""} $${p}`).join(" · ")}
                  </p>
                </div>
                <span style={{ color: colors.primaryLight, fontSize: 14 }}>Ver detalhes →</span>
              </div>
            ))}
          </div>

          {runs.length > 0 && (
            <>
              <h3 style={{ fontSize: 16, margin: "24px 0 12px" }}>Meus campeonatos</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {runs.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRunId(r.id)}
                    style={{
                      padding: 12,
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between"
                    }}
                  >
                    <span>{r.name}</span>
                    <span style={{ color: colors.textMuted, fontSize: 13 }}>
                      {r.status === "finished" ? "Encerrado" : `${r.matchCount} partidas`} · Ver →
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
};

function ChampionshipMatchChips({
  activeMatches,
  watchedId,
  onWatch,
  onRemove
}: {
  activeMatches: Map<string, { matchId: string; apiMatch: ApiMatch }>;
  watchedId: string | null;
  onWatch: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const entries = [...activeMatches.entries()];
  if (entries.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {entries.map(([leagueId, { matchId, apiMatch }]) => (
        <ChampionshipMatchChip
          key={leagueId}
          leagueId={leagueId}
          matchId={matchId}
          apiMatch={apiMatch}
          isWatched={watchedId === leagueId}
          onWatch={() => onWatch(leagueId)}
          onRemove={() => onRemove(leagueId)}
        />
      ))}
    </div>
  );
}

function ChampionshipMatchChip({
  leagueId,
  matchId,
  apiMatch,
  isWatched,
  onWatch,
  onRemove
}: {
  leagueId: string;
  matchId: string;
  apiMatch: ApiMatch;
  isWatched: boolean;
  onWatch: () => void;
  onRemove: () => void;
}) {
  const { state } = useMatch(matchId);
  const ended = state && (state.matchWinner != null || state.matchDraw);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: isWatched ? colors.primary : ended ? "#334155" : "#1e293b",
        border: `1px solid ${isWatched ? colors.primary : "#475569"}`,
        borderRadius: radii.md,
        cursor: "pointer"
      }}
      onClick={onWatch}
      title={`${apiMatch.teamA.name} vs ${apiMatch.teamB.name}`}
    >
      <span style={{ fontSize: typography.fontSize.sm, color: "#e2e8f0" }}>
        {apiMatch.teamA.name} {state ? `${state.score.RED}-${state.score.BLU}` : "0-0"} {apiMatch.teamB.name}
      </span>
      <span style={{ color: "#64748b", fontSize: 11 }}>
        R{state?.round ?? 0}{state?.isRunning ? " ●" : ended ? " ✓" : ""}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          padding: "2px 6px",
          background: "transparent",
          border: "none",
          color: colors.textMuted,
          cursor: "pointer",
          fontSize: 12
        }}
        title="Encerrar e remover"
      >
        ×
      </button>
    </div>
  );
}

function ChampionshipStartMoreBar({
  run,
  activeMap,
  onPlay
}: {
  run: ChampionshipRun;
  activeMap: Map<string, { matchId: string; apiMatch: ApiMatch }>;
  onPlay: (m: ApiMatch) => void;
}) {
  const scheduled = run.matches.filter((m) => m.status === "scheduled" && !activeMap.has(m.id));
  if (scheduled.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: spacing.md }}>
      <span style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>Iniciar outra:</span>
      {scheduled.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onPlay(m)}
          style={{
            padding: "4px 12px",
            background: colors.bgInput,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.sm,
            color: colors.primaryLight,
            fontSize: typography.fontSize.sm,
            cursor: "pointer"
          }}
        >
          {m.teamA.name} vs {m.teamB.name}
        </button>
      ))}
    </div>
  );
}

function ChampionshipDetailView({
  template,
  onStart,
  onBack,
  starting
}: {
  template: ChampionshipTemplate;
  onStart: () => void;
  onBack: () => void;
  starting: boolean;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        style={{
          padding: "8px 0",
          background: "none",
          border: "none",
          color: colors.primaryLight,
          cursor: "pointer",
          marginBottom: 16
        }}
      >
        ← Voltar
      </button>
      <h3 style={{ marginTop: 0 }}>{template.name}</h3>
      <p style={{ color: colors.textMuted }}>{template.description}</p>
      <ul style={{ margin: "12px 0", paddingLeft: 20 }}>
        <li>{template.format} times</li>
        <li>{template.matchCount} partida(s)</li>
        <li>Formato: mata-mata (eliminatória simples)</li>
      </ul>
      <p style={{ color: colors.gold, margin: "16px 0 8px" }}>
        Premiação: {template.prizes.map((p, i) => `${["1º", "2º", "3º", "4º"][i] ?? ""} $${p}`).join(" · ")}
      </p>
      <p style={{ fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
        Seu time será inscrito automaticamente. Os demais slots serão preenchidos com times aleatórios.
      </p>
      <button
        onClick={onStart}
        disabled={starting}
        style={{
          padding: "12px 24px",
          background: colors.primary,
          border: "none",
          borderRadius: 8,
          color: "#fff",
          fontWeight: 600,
          cursor: starting ? "not-allowed" : "pointer"
        }}
      >
        {starting ? "Iniciando..." : "Iniciar campeonato"}
      </button>
    </div>
  );
}

function ChampionshipRunView({
  run,
  mapId,
  onMapChange,
  maps,
  onBack,
  onPlayMatch
}: {
  run: ChampionshipRun;
  mapId: string;
  onMapChange: (id: string) => void;
  maps: MapInfo[];
  onBack: () => void;
  onPlayMatch: (m: ApiMatch) => void;
}) {
  const scheduled = run.matches.filter((m) => m.status === "scheduled");

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          padding: "8px 0",
          background: "none",
          border: "none",
          color: colors.primaryLight,
          cursor: "pointer",
          marginBottom: 16
        }}
      >
        ← Voltar
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: "0 0 4px" }}>{run.name}</h3>
          <p style={{ color: colors.textMuted, margin: 0 }}>
            {run.status === "finished" ? "Campeonato encerrado" : `${scheduled.length} partida(s) pendente(s)`}
          </p>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: colors.textMuted, fontSize: 14, marginLeft: "auto" }}>
          Mapa:
          <select
            value={mapId}
            onChange={(e) => onMapChange(e.target.value)}
            style={{
              padding: "6px 12px",
              background: colors.bgInput,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.md,
              color: colors.text,
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

      <BracketView run={run} onPlayMatch={onPlayMatch} />
    </div>
  );
}
