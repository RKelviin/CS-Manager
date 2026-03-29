import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import {
  createSandboxBot,
  sandboxMatchRegistry,
  SANDBOX_SELECTABLE_PRIMARIES,
  secondaryPistolForBotTeam,
  type BluStrategy,
  type MatchEvent,
  type MatchSetup,
  type RedStrategy,
  type SandboxCombatOverrides,
  type SandboxSelectablePrimary,
  type TeamSide
} from "../features/replay";
import { DUST2_MAP } from "../features/replay/map/dust2Map";
import { SIMULATION_TICK_MS } from "../features/replay/simulation";
import { GameCanvas } from "../features/replay/ui/GameCanvas";
import { MatchControls } from "../features/replay/ui/MatchControls";
import { theme } from "../theme";

const { colors, spacing, typography, radii } = theme;

const RED_OPTIONS: { value: RedStrategy; label: string }[] = [
  { value: "rush", label: "Rush" },
  { value: "split", label: "Split" },
  { value: "slow", label: "Slow" },
  { value: "default", label: "Default" },
  { value: "fake", label: "Fake" }
];

const BLU_OPTIONS: { value: BluStrategy; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "stack-a", label: "Stack A" },
  { value: "stack-b", label: "Stack B" },
  { value: "aggressive", label: "Agressivo" },
  { value: "hold", label: "Hold" },
  { value: "retake", label: "Retake" },
  { value: "rotate", label: "Rotate" }
];

const labelForParam = (key: "damage" | "precision" | "range") =>
  key === "damage" ? "DMG" : key === "precision" ? "Precisão" : "Alcance";

/** Escala dos sliders de combate na Sandbox (% do padrão do motor). */
const SANDBOX_COMBAT_PCT_MIN = 0;
const SANDBOX_COMBAT_PCT_MAX = 200;
const SANDBOX_COMBAT_PCT_DEFAULT = 100;

const defaultCombatRow = () => ({
  damage: SANDBOX_COMBAT_PCT_DEFAULT,
  precision: SANDBOX_COMBAT_PCT_DEFAULT,
  range: SANDBOX_COMBAT_PCT_DEFAULT
});

function IconResetParam() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    </svg>
  );
}

const selectStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: 8,
  borderRadius: radii.md,
  border: `1px solid ${colors.border}`,
  background: colors.bgElevated,
  color: colors.text
};

export const PlaytestLabPage = () => {
  const setup = useMemo(
    (): MatchSetup => ({
      teamAName: "Sandbox RED",
      teamBName: "Sandbox BLU",
      teamAPlayers: ["R1", "R2", "R3", "R4", "R5"],
      teamBPlayers: ["B1", "B2", "B3", "B4", "B5"],
      teamAStartsAs: "RED",
      mapData: DUST2_MAP,
      matchType: "friendly",
      sandboxMode: true,
      sandboxCombatOverrides: {},
      sandboxBotPrimaryWeapon: "AK-47"
    }),
    []
  );

  const [matchId, setMatchId] = useState<string | null>(null);
  const [tuningWeapon, setTuningWeapon] = useState<SandboxSelectablePrimary>("AK-47");
  const [paramLog, setParamLog] = useState<string[]>([]);
  const [showNavMesh, setShowNavMesh] = useState(false);
  const [showNavPaths, setShowNavPaths] = useState(false);
  const [snapNavOnSpawn, setSnapNavOnSpawn] = useState(true);
  const [spawnTeam, setSpawnTeam] = useState<TeamSide | null>(null);
  const [spawnHint, setSpawnHint] = useState<string | null>(null);
  const committedCombat = useRef<SandboxCombatOverrides>({});

  useEffect(() => {
    const id = sandboxMatchRegistry.startMatch(setup);
    setMatchId(id);
    committedCombat.current = JSON.parse(JSON.stringify(setup.sandboxCombatOverrides ?? {})) as SandboxCombatOverrides;
    return () => {
      sandboxMatchRegistry.removeMatch(id);
    };
  }, [setup]);

  const state = useSyncExternalStore(
    (onStoreChange) => {
      if (!matchId) return () => {};
      return sandboxMatchRegistry.subscribe(matchId, () => onStoreChange());
    },
    () => (matchId ? sandboxMatchRegistry.getMatch(matchId) : null),
    () => null
  );

  const appendLog = useCallback((line: string) => {
    setParamLog((prev) => [...prev, line]);
  }, []);

  const dispatch = useCallback(
    (event: MatchEvent) => {
      if (matchId) sandboxMatchRegistry.dispatch(matchId, event);
    },
    [matchId]
  );

  const patch = useCallback(
    (fn: (s: NonNullable<typeof state>) => void) => {
      if (matchId) sandboxMatchRegistry.patchMatch(matchId, fn);
    },
    [matchId, state]
  );

  const commitCombatSlider = useCallback(
    (weapon: string, param: "damage" | "precision" | "range", value: number) => {
      const prevRow = committedCombat.current[weapon] ?? defaultCombatRow();
      const prevVal = Math.round(prevRow[param]);
      const nextVal = Math.round(
        Math.min(SANDBOX_COMBAT_PCT_MAX, Math.max(SANDBOX_COMBAT_PCT_MIN, value))
      );
      if (prevVal === nextVal) return;
      const label = labelForParam(param);
      appendLog(`${label} de ${weapon} alterado de ${prevVal} para ${nextVal}`);
      const nextRow = { ...prevRow, [param]: nextVal };
      committedCombat.current = {
        ...committedCombat.current,
        [weapon]: nextRow
      };
      patch((s) => {
        s.sandboxCombatOverrides = {
          ...(s.sandboxCombatOverrides ?? {}),
          [weapon]: { ...(s.sandboxCombatOverrides?.[weapon] ?? prevRow), [param]: nextVal }
        };
      });
    },
    [appendLog, patch]
  );

  const resetCombatParam = useCallback(
    (weapon: string, param: "damage" | "precision" | "range") => {
      if (!state) return;
      const row = state.sandboxCombatOverrides?.[weapon] ?? defaultCombatRow();
      const cur = Math.round(row[param]);
      if (cur !== SANDBOX_COMBAT_PCT_DEFAULT) {
        appendLog(
          `${labelForParam(param)} de ${weapon} alterado de ${cur} para ${SANDBOX_COMBAT_PCT_DEFAULT}`
        );
      }
      const prevRow = committedCombat.current[weapon] ?? defaultCombatRow();
      committedCombat.current = {
        ...committedCombat.current,
        [weapon]: { ...prevRow, [param]: SANDBOX_COMBAT_PCT_DEFAULT }
      };
      patch((s) => {
        const curRow = s.sandboxCombatOverrides?.[weapon] ?? defaultCombatRow();
        s.sandboxCombatOverrides = {
          ...(s.sandboxCombatOverrides ?? {}),
          [weapon]: { ...curRow, [param]: SANDBOX_COMBAT_PCT_DEFAULT }
        };
      });
    },
    [appendLog, patch, state]
  );

  const onMapWorldClick = useCallback(
    (x: number, y: number) => {
      if (spawnTeam == null || !matchId) return;
      patch((s) => {
        const res = createSandboxBot({
          map: s.mapData,
          team: spawnTeam,
          x,
          y,
          snapNav: snapNavOnSpawn,
          primaryWeapon: s.sandboxBotPrimaryWeapon,
          round: s.round,
          teamAStartsAs: s.teamAStartsAs
        });
        if (!res.ok) {
          setSpawnHint(res.error);
          return;
        }
        setSpawnHint(`Bot ${res.bot.name} em (${Math.round(res.x)}, ${Math.round(res.y)})`);
        s.bots = [...s.bots, res.bot];
      });
    },
    [matchId, patch, snapNavOnSpawn, spawnTeam]
  );

  const labProps = useMemo(
    () => ({
      showNavMesh,
      showBotNavPaths: showNavPaths,
      onMapWorldClick: spawnTeam != null ? onMapWorldClick : undefined
    }),
    [showNavMesh, showNavPaths, spawnTeam, onMapWorldClick]
  );

  if (!state) {
    return <p style={{ color: colors.textMuted }}>Carregando laboratório…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <header>
        <h1 style={{ margin: 0, fontSize: typography.fontSize["2xl"], fontWeight: typography.fontWeight.bold }}>
          Sandbox
        </h1>
        <p style={{ margin: `${spacing.xs}px 0 0`, color: colors.textMuted, fontSize: typography.fontSize.md }}>
          Motor de simulação isolado da liga — ajuste combate, passo a passo com pausa e spawn por clique.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing.xl,
          alignItems: "flex-start"
        }}
      >
        <div style={{ flex: "0 0 min(360px, 100%)", display: "flex", flexDirection: "column", gap: spacing.lg }}>
          <section
            style={{
              padding: spacing.lg,
              borderRadius: radii.lg,
              border: `1px solid ${colors.border}`,
              background: colors.bg
            }}
          >
            <h2 style={{ margin: `0 0 ${spacing.md}px`, fontSize: typography.fontSize.lg }}>Partida</h2>
            <p style={{ margin: `0 0 ${spacing.sm}px`, color: colors.textMuted, fontSize: typography.fontSize.sm }}>
              Mapa: {state.mapData.name}
            </p>
            <MatchControls
              isRunning={state.isRunning}
              matchEnded={state.matchWinner != null || state.matchDraw}
              canFinishRound={state.pendingRoundAdvance == null && state.matchWinner == null && !state.matchDraw}
              onStart={() => dispatch({ type: "START" })}
              onPause={() => dispatch({ type: "PAUSE" })}
              onReset={() => dispatch({ type: "RESET" })}
              onFinishRound={() => dispatch({ type: "FINISH_ROUND" })}
              labels={{
                start: "Iniciar",
                pause: "Pausar",
                finishRound: "Finalizar round"
              }}
            />
            <div style={{ marginTop: spacing.md, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => dispatch({ type: "STEP", deltaMs: SIMULATION_TICK_MS })}
                disabled={!state.sandboxMode}
                style={{
                  padding: "8px 14px",
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.bgElevated,
                  color: colors.text,
                  cursor: state.sandboxMode ? "pointer" : "not-allowed",
                  opacity: state.sandboxMode ? 1 : 0.5
                }}
              >
                Passo ({SIMULATION_TICK_MS} ms)
              </button>
            </div>
          </section>

          <section
            style={{
              padding: spacing.lg,
              borderRadius: radii.lg,
              border: `1px solid ${colors.border}`,
              background: colors.bg
            }}
          >
            <h2 style={{ margin: `0 0 ${spacing.md}px`, fontSize: typography.fontSize.lg }}>Estratégia</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <label style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
                RED (ataque)
                <select
                  value={state.redStrategy}
                  onChange={(e) =>
                    patch((s) => {
                      s.redStrategy = e.target.value as RedStrategy;
                      s.activeRedSideStrategyKey = e.target.value;
                    })
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    borderRadius: radii.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.bgElevated,
                    color: colors.text
                  }}
                >
                  {RED_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
                BLU (defesa)
                <select
                  value={state.bluStrategy}
                  onChange={(e) =>
                    patch((s) => {
                      s.bluStrategy = e.target.value as BluStrategy;
                      s.activeBluSideStrategyKey = e.target.value;
                    })
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    borderRadius: radii.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.bgElevated,
                    color: colors.text
                  }}
                >
                  {BLU_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section
            style={{
              padding: spacing.lg,
              borderRadius: radii.lg,
              border: `1px solid ${colors.border}`,
              background: colors.bg
            }}
          >
            <h2 style={{ margin: `0 0 ${spacing.md}px`, fontSize: typography.fontSize.lg }}>Combate</h2>
            <p style={{ margin: `0 0 ${spacing.md}px`, fontSize: typography.fontSize.sm, color: colors.textMuted }}>
              Valores 0–200% (100% = padrão do motor). Ajuste ao soltar o controle; use o ícone para voltar a 100%.
            </p>

            <label style={{ display: "block", fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.md }}>
              Arma equipada pelos jogadores
              <select
                value={state.sandboxBotPrimaryWeapon ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  patch((s) => {
                    if (!v) {
                      s.sandboxBotPrimaryWeapon = undefined;
                      for (const b of s.bots) {
                        if (b.hp <= 0) continue;
                        const p = secondaryPistolForBotTeam(b.team, s.round, s.teamAStartsAs);
                        b.primaryWeapon = p;
                        b.secondaryWeapon = p;
                      }
                    } else {
                      s.sandboxBotPrimaryWeapon = v;
                      for (const b of s.bots) {
                        if (b.hp <= 0) continue;
                        b.primaryWeapon = v;
                        b.secondaryWeapon = secondaryPistolForBotTeam(b.team, s.round, s.teamAStartsAs);
                      }
                    }
                  });
                }}
                style={selectStyle}
              >
                <option value="">Padrão (pistola por lado)</option>
                {SANDBOX_SELECTABLE_PRIMARIES.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "block", fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm }}>
              Ajustar parâmetros de combate (arma)
              <select
                value={tuningWeapon}
                onChange={(e) => setTuningWeapon(e.target.value as SandboxSelectablePrimary)}
                style={selectStyle}
              >
                {SANDBOX_SELECTABLE_PRIMARIES.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>

            {(() => {
              const wpn = tuningWeapon;
              const row = state.sandboxCombatOverrides?.[wpn] ?? defaultCombatRow();
              const resetBtnStyle: CSSProperties = {
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                padding: 0,
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: colors.bgElevated,
                color: colors.textMuted,
                cursor: "pointer"
              };
              return (
                <div style={{ marginTop: spacing.md }}>
                  <div style={{ fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm }}>{wpn}</div>
                  {(
                    [
                      ["damage", "DMG"],
                      ["precision", "Precisão"],
                      ["range", "Alcance"]
                    ] as const
                  ).map(([key, title]) => (
                    <div
                      key={key}
                      style={{
                        marginBottom: spacing.sm,
                        fontSize: typography.fontSize.sm,
                        color: colors.textMuted
                      }}
                    >
                      <div style={{ marginBottom: 4 }}>
                        {title}: {Math.round(row[key])}%
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
                        <input
                          type="range"
                          min={SANDBOX_COMBAT_PCT_MIN}
                          max={SANDBOX_COMBAT_PCT_MAX}
                          value={Math.min(SANDBOX_COMBAT_PCT_MAX, Math.max(SANDBOX_COMBAT_PCT_MIN, row[key]))}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            patch((s) => {
                              const cur = s.sandboxCombatOverrides?.[wpn] ?? defaultCombatRow();
                              s.sandboxCombatOverrides = {
                                ...(s.sandboxCombatOverrides ?? {}),
                                [wpn]: { ...cur, [key]: v }
                              };
                            });
                          }}
                          onPointerUp={(e) =>
                            commitCombatSlider(wpn, key, Number((e.target as HTMLInputElement).value))
                          }
                          style={{ flex: 1, minWidth: 0, marginTop: 0 }}
                        />
                        <button
                          type="button"
                          title="Restaurar 100%"
                          aria-label={`Restaurar ${title} para 100%`}
                          onClick={() => resetCombatParam(wpn, key)}
                          style={resetBtnStyle}
                        >
                          <IconResetParam />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>

          <section
            style={{
              padding: spacing.lg,
              borderRadius: radii.lg,
              border: `1px solid ${colors.border}`,
              background: colors.bg
            }}
          >
            <h2 style={{ margin: `0 0 ${spacing.md}px`, fontSize: typography.fontSize.lg }}>Mapa / spawn</h2>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: spacing.sm, cursor: "pointer" }}>
              <input type="checkbox" checked={showNavMesh} onChange={(e) => setShowNavMesh(e.target.checked)} />
              <span style={{ fontSize: typography.fontSize.sm }}>Malha de navegação</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: spacing.sm, cursor: "pointer" }}>
              <input type="checkbox" checked={showNavPaths} onChange={(e) => setShowNavPaths(e.target.checked)} />
              <span style={{ fontSize: typography.fontSize.sm }}>Caminhos (navPath)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: spacing.md, cursor: "pointer" }}>
              <input type="checkbox" checked={snapNavOnSpawn} onChange={(e) => setSnapNavOnSpawn(e.target.checked)} />
              <span style={{ fontSize: typography.fontSize.sm }}>Snap ao nó de nav ao spawnar</span>
            </label>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  if (spawnTeam === "RED") {
                    setSpawnTeam(null);
                    setSpawnHint(null);
                  } else {
                    setSpawnTeam("RED");
                    setSpawnHint("Clique no mapa para spawn RED");
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                  background: spawnTeam === "RED" ? colors.primary : colors.bgElevated,
                  color: spawnTeam === "RED" ? "#fff" : colors.text,
                  cursor: "pointer"
                }}
              >
                {spawnTeam === "RED" ? "Cancelar spawn RED" : "Spawn RED (clique)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (spawnTeam === "BLU") {
                    setSpawnTeam(null);
                    setSpawnHint(null);
                  } else {
                    setSpawnTeam("BLU");
                    setSpawnHint("Clique no mapa para spawn BLU");
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                  background: spawnTeam === "BLU" ? colors.primary : colors.bgElevated,
                  color: spawnTeam === "BLU" ? "#fff" : colors.text,
                  cursor: "pointer"
                }}
              >
                {spawnTeam === "BLU" ? "Cancelar spawn BLU" : "Spawn BLU (clique)"}
              </button>
            </div>
            {spawnHint ? (
              <p style={{ margin: `${spacing.sm}px 0 0`, fontSize: typography.fontSize.sm, color: colors.textMuted }}>
                {spawnHint}
              </p>
            ) : null}
          </section>

          <section>
            <h2 style={{ margin: `0 0 ${spacing.sm}px`, fontSize: typography.fontSize.md }}>Registro de parâmetros</h2>
            <textarea
              readOnly
              value={paramLog.length ? paramLog.join("\n") : ""}
              placeholder="Alterações de DMG, precisão e alcance aparecem aqui."
              rows={6}
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                padding: spacing.md,
                borderRadius: radii.md,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.text
              }}
            />
          </section>
        </div>

        <div style={{ flex: "1 1 400px", minWidth: 280 }}>
          <GameCanvas state={state} lab={labProps} />
        </div>
      </div>
    </div>
  );
};
