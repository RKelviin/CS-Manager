import { useCallback, useMemo, useState } from "react";
import { useMatchContext, useMatch } from "../features/replay";
import { matchRegistry } from "../features/replay/state/matchRegistry";
import {
  ALL_BLU_STRATEGY_KEYS,
  ALL_RED_STRATEGY_KEYS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  clampStrategyWeight,
  defaultStrategyWeights,
  tryReactivateCustomStrategy
} from "../features/replay/engine/strategyLearning";
import type { StrategyRoundHistoryEntry } from "../features/replay/types";
import { theme } from "../theme";

const { colors, spacing, radii } = theme;

type SideFilter = "all" | "RED" | "BLU";
type KindFilter = "all" | "base" | "custom";

function clampW(w: number): number {
  return clampStrategyWeight(w);
}

/** Série aproximada de peso ao longo dos rounds (só eventos em que esta chave foi usada no pool). */
function weightEvolutionForKey(
  history: StrategyRoundHistoryEntry[],
  side: "RED" | "BLU",
  key: string
): { round: number; weight: number }[] {
  const pts: { round: number; weight: number }[] = [{ round: 0, weight: 1 }];
  let w = 1;
  for (const h of history) {
    const used = side === "RED" ? h.trStrategyKey : h.ctStrategyKey;
    if (used !== key) continue;
    const won = side === "RED" ? h.trWon : !h.trWon;
    w = clampW(w + (won ? 0.15 : -0.08));
    pts.push({ round: h.round, weight: w });
  }
  return pts;
}

export const StrategiesPage = () => {
  const ctx = useMatchContext();
  const watchedId = ctx?.watchedMatchId ?? null;
  const { state } = useMatch(watchedId);
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  /** `${side}::${key}` — default existe em TR e CT */
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [reactivateNotice, setReactivateNotice] = useState<string | null>(null);

  const ids = ctx?.listMatchIds() ?? [];

  const rows = useMemo(() => {
    if (!state) return [];
    const hist = state.strategyHistory ?? [];
    const w = state.strategyWeights ?? defaultStrategyWeights();
    const keysRed = new Set<string>([...ALL_RED_STRATEGY_KEYS, ...Object.keys(w.RED)]);
    const keysBlu = new Set<string>([...ALL_BLU_STRATEGY_KEYS, ...Object.keys(w.BLU)]);
    const customR = new Set(state.customRedStrategies?.map((c) => c.id) ?? []);
    const customB = new Set(state.customBluStrategies?.map((c) => c.id) ?? []);

    const statsFor = (side: "RED" | "BLU", key: string) => {
      let wins = 0;
      let losses = 0;
      for (const h of hist) {
        const used = side === "RED" ? h.trStrategyKey : h.ctStrategyKey;
        if (used !== key) continue;
        const won = side === "RED" ? h.trWon : !h.trWon;
        if (won) wins++;
        else losses++;
      }
      const n = wins + losses;
      const pct = n === 0 ? 0 : Math.round((wins / n) * 1000) / 10;
      const weight = side === "RED" ? w.RED[key] ?? 1 : w.BLU[key] ?? 1;
      const isCustom = side === "RED" ? customR.has(key) : customB.has(key);
      return { wins, losses, pct, weight, isCustom };
    };

    const out: {
      side: "RED" | "BLU";
      key: string;
      wins: number;
      losses: number;
      pct: number;
      weight: number;
      isCustom: boolean;
    }[] = [];

    for (const k of keysRed) {
      const s = statsFor("RED", k);
      out.push({ side: "RED", key: k, ...s });
    }
    for (const k of keysBlu) {
      const s = statsFor("BLU", k);
      out.push({ side: "BLU", key: k, ...s });
    }
    return out;
  }, [state]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (sideFilter !== "all" && r.side !== sideFilter) return false;
      if (kindFilter === "base" && r.isCustom) return false;
      if (kindFilter === "custom" && !r.isCustom) return false;
      return true;
    });
  }, [rows, sideFilter, kindFilter]);

  const summary = useMemo(() => {
    if (!filtered.length) return null;
    const byRate = [...filtered].filter((r) => r.wins + r.losses > 0);
    const best = byRate.length ? byRate.reduce((a, b) => (a.pct >= b.pct ? a : b)) : null;
    const leastUsed = [...filtered].reduce((a, b) =>
      a.wins + a.losses <= b.wins + b.losses ? a : b
    );
    const weights = filtered.map((r) => r.weight);
    const wMax = weights.length ? Math.max(...weights) : 1;
    const wMin = weights.length ? Math.min(...weights) : 1;
    return { best, leastUsed, wMax, wMin };
  }, [filtered]);

  const evolution = useMemo(() => {
    if (!state || !selectedRowId) return [];
    const [side, key] = selectedRowId.split("::") as ["RED" | "BLU", string];
    if (!key) return [];
    return weightEvolutionForKey(state.strategyHistory ?? [], side, key);
  }, [state, selectedRowId]);

  const reactivateCustom = useCallback(
    (side: "RED" | "BLU", id: string) => {
      if (!watchedId) return;
      setReactivateNotice(null);
      matchRegistry.patchMatch(watchedId, (st) => {
        const list = side === "RED" ? st.customRedStrategies : st.customBluStrategies;
        const result = tryReactivateCustomStrategy(list, id, st.round);
        if (!result.ok) {
          setReactivateNotice(result.message);
          return;
        }
        if (result.archivedPeerId != null) {
          setReactivateNotice(
            `Reativada. Limite de ativas: a estratégia "${result.archivedPeerId}" foi arquivada automaticamente.`
          );
        }
      });
    },
    [watchedId]
  );

  if (!ctx) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Estratégias (TR / CT)</h1>
      <p style={{ color: colors.textMuted, margin: 0, fontSize: 14 }}>
        Estatísticas e pesos aprendidos da partida em foco. Escolha uma partida na Simulação (matchId na URL) ou
        inicie uma nova.
      </p>

      {ids.length > 0 && (
        <div style={{ fontSize: 13, color: colors.textMuted }}>
          Partidas em memória: {ids.length}. Assistindo: {watchedId ?? "nenhuma"}.
        </div>
      )}

      {!state && (
        <p style={{ color: colors.textMuted }}>
          Não há estado de partida carregado. Abra a Simulação e inicie ou assista uma partida.
        </p>
      )}

      {state && (
        <>
          {reactivateNotice != null && (
            <div
              role="status"
              style={{
                fontSize: 13,
                padding: spacing.sm,
                borderRadius: radii.md,
                border: `1px solid ${colors.border}`,
                background: colors.bgElevated,
                color: colors.text
              }}
            >
              {reactivateNotice}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.md, alignItems: "center" }}>
            <label style={{ fontSize: 13 }}>
              Time{" "}
              <select
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value as SideFilter)}
                style={selectStyle}
              >
                <option value="all">Todos</option>
                <option value="RED">TR (pool RED)</option>
                <option value="BLU">CT (pool BLU)</option>
              </select>
            </label>
            <label style={{ fontSize: 13 }}>
              Tipo{" "}
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as KindFilter)}
                style={selectStyle}
              >
                <option value="all">Todas</option>
                <option value="base">Só base</option>
                <option value="custom">Só custom / emergentes</option>
              </select>
            </label>
          </div>

          {summary && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: spacing.md,
                fontSize: 13
              }}
            >
              <div style={cardStyle}>
                <div style={{ color: colors.textMuted }}>Mais bem-sucedida (com jogos)</div>
                <div style={{ fontWeight: 600 }}>
                  {summary.best
                    ? `${summary.best.side} · ${summary.best.key} (${summary.best.pct}%)`
                    : "—"}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ color: colors.textMuted }}>Menos usada (soma jogos)</div>
                <div style={{ fontWeight: 600 }}>
                  {summary.leastUsed.side} · {summary.leastUsed.key} (
                  {summary.leastUsed.wins + summary.leastUsed.losses} rounds)
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ color: colors.textMuted }}>Peso máx / mín (filtro atual)</div>
                <div style={{ fontWeight: 600 }}>
                  {summary.wMax.toFixed(2)}x · {summary.wMin.toFixed(2)}x (limite {WEIGHT_MIN}x–{WEIGHT_MAX}x)
                </div>
              </div>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                  <th style={thStyle}>Pool</th>
                  <th style={thStyle}>Estratégia</th>
                  <th style={thStyle}>Vitórias</th>
                  <th style={thStyle}>Derrotas</th>
                  <th style={thStyle}>Win %</th>
                  <th style={thStyle}>Peso</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const rowId = `${r.side}::${r.key}`;
                  return (
                  <tr
                    key={rowId}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      background: selectedRowId === rowId ? "rgba(99,102,241,0.08)" : undefined
                    }}
                  >
                    <td style={tdStyle}>{r.side === "RED" ? "TR" : "CT"}</td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => setSelectedRowId(rowId)}
                        style={{
                          background: "none",
                          border: "none",
                          color: colors.accent,
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: selectedRowId === rowId ? "underline" : undefined
                        }}
                      >
                        {r.key}
                      </button>
                      {r.isCustom ? " · custom" : ""}
                    </td>
                    <td style={tdStyle}>{r.wins}</td>
                    <td style={tdStyle}>{r.losses}</td>
                    <td style={tdStyle}>{r.pct}%</td>
                    <td style={tdStyle}>{r.weight.toFixed(2)}x</td>
                    <td style={tdStyle}>
                      {r.isCustom &&
                        (() => {
                          const arch =
                            r.side === "RED"
                              ? state.customRedStrategies?.find((c) => c.id === r.key)?.archivedAtRound
                              : state.customBluStrategies?.find((c) => c.id === r.key)?.archivedAtRound;
                          return arch != null ? (
                            <button
                              type="button"
                              onClick={() => reactivateCustom(r.side, r.key)}
                              style={smallBtn}
                            >
                              Reativar
                            </button>
                          ) : null;
                        })()}
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>

          {selectedRowId && evolution.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontWeight: 600, marginBottom: spacing.sm }}>
                Evolução aproximada do peso: {selectedRowId.replace("::", " · ")}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120 }}>
                {evolution.map((p, i) => {
                  const h = 20 + ((p.weight - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN)) * 90;
                  return (
                    <div
                      key={`${p.round}-${i}`}
                      title={`R${p.round} → ${p.weight.toFixed(2)}x`}
                      style={{
                        flex: 1,
                        minWidth: 4,
                        maxWidth: 12,
                        height: `${h}px`,
                        background: colors.accent,
                        borderRadius: radii.sm
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>
                Barras proporcionais ao peso reconstruído após cada round em que a chave foi usada.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const selectStyle: React.CSSProperties = {
  marginLeft: 8,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${theme.colors.border}`,
  background: theme.colors.bg,
  color: theme.colors.text
};

const cardStyle: React.CSSProperties = {
  padding: spacing.md,
  borderRadius: radii.lg,
  border: `1px solid ${colors.border}`,
  background: colors.bg
};

const thStyle: React.CSSProperties = { padding: "8px 10px", color: colors.textMuted };
const tdStyle: React.CSSProperties = { padding: "8px 10px" };
const smallBtn: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 6,
  border: `1px solid ${colors.border}`,
  background: colors.bgElevated,
  color: colors.text,
  cursor: "pointer"
};
