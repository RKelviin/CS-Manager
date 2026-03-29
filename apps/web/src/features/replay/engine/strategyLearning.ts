import type {
  BluStrategy,
  CustomBluStrategy,
  CustomRedStrategy,
  MatchState,
  RedStrategy,
  TeamSide
} from "../types";
import { getRedSideTeamFromState } from "./matchConstants";

export const ALL_RED_STRATEGY_KEYS: RedStrategy[] = ["rush", "split", "slow", "default", "fake"];
export const ALL_BLU_STRATEGY_KEYS: BluStrategy[] = [
  "default",
  "stack-a",
  "stack-b",
  "aggressive",
  "hold",
  "retake",
  "rotate"
];

/** Máximo de estratégias custom / emergentes ativas por pool (roster RED ou BLU) */
export const ACTIVE_CUSTOM_STRATEGY_CAP = 5;

/** Bases do papel BLU válidas para emergentes em contexto pré-plant (exclui retake) */
export const BLU_BASE_KEYS_PRE_PLANT_EMERGENT: BluStrategy[] = [
  "default",
  "stack-a",
  "stack-b",
  "aggressive",
  "hold",
  "rotate"
];

type CustomStratWithArchive = {
  id: string;
  archivedAtRound?: number;
  stats: { wins: number; losses: number };
};

function sortByWorstPerformance(
  a: { wr: number; c: CustomStratWithArchive },
  b: { wr: number; c: CustomStratWithArchive }
): number {
  return a.wr - b.wr || a.c.stats.losses - b.c.stats.losses || a.c.stats.wins - b.c.stats.wins;
}

/** Arquiva a custom ativa com pior desempenho. Retorna o id arquivado, se houver. */
export function archiveWorstActiveCustom(list: CustomStratWithArchive[], round: number): string | undefined {
  const active = list.filter((c) => !c.archivedAtRound);
  if (active.length === 0) return undefined;
  const scored = active.map((c) => ({
    c,
    wr: c.stats.wins + c.stats.losses === 0 ? 0 : c.stats.wins / (c.stats.wins + c.stats.losses)
  }));
  scored.sort(sortByWorstPerformance);
  const victim = scored[0]?.c;
  if (!victim) return undefined;
  victim.archivedAtRound = round;
  return victim.id;
}

/** Se já há `cap` ativas, arquiva a pior uma vez para abrir vaga (ex.: nova emergente). */
export function ensureRoomForNewEmergentCustom(
  list: CustomStratWithArchive[],
  round: number,
  cap: number = ACTIVE_CUSTOM_STRATEGY_CAP
): void {
  const active = list.filter((c) => !c.archivedAtRound);
  if (active.length >= cap) archiveWorstActiveCustom(list, round);
}

export type ReactivateCustomResult =
  | { ok: true; archivedPeerId?: string }
  | { ok: false; message: string };

/**
 * Reativa uma estratégia arquivada respeitando o teto de ativas: com pool cheio, arquiva a pior ativa antes.
 */
export function tryReactivateCustomStrategy(
  list: Array<CustomRedStrategy | CustomBluStrategy>,
  id: string,
  round: number,
  cap: number = ACTIVE_CUSTOM_STRATEGY_CAP
): ReactivateCustomResult {
  const target = list.find((c) => c.id === id);
  if (!target) return { ok: false, message: "Estratégia não encontrada." };
  if (target.archivedAtRound == null) return { ok: false, message: "Esta estratégia já está ativa." };

  const active = list.filter((c) => !c.archivedAtRound);
  let archivedPeerId: string | undefined;
  if (active.length >= cap) {
    archivedPeerId = archiveWorstActiveCustom(list, round);
    if (archivedPeerId == null)
      return { ok: false, message: "Não foi possível liberar vaga no pool." };
  }

  delete target.archivedAtRound;
  return { ok: true, archivedPeerId };
}

export const DEFAULT_STRATEGY_WEIGHT = 1;
export const WEIGHT_MIN = 0.5;
export const WEIGHT_MAX = 2;

export function defaultStrategyWeights(): {
  RED: Record<string, number>;
  BLU: Record<string, number>;
} {
  const RED: Record<string, number> = {};
  const BLU: Record<string, number> = {};
  for (const k of ALL_RED_STRATEGY_KEYS) RED[k] = DEFAULT_STRATEGY_WEIGHT;
  for (const k of ALL_BLU_STRATEGY_KEYS) BLU[k] = DEFAULT_STRATEGY_WEIGHT;
  return { RED, BLU };
}

export function ensureWeightKeys(state: MatchState): void {
  const d = defaultStrategyWeights();
  state.strategyWeights ??= d;
  for (const k of ALL_RED_STRATEGY_KEYS) {
    if (state.strategyWeights.RED[k] == null) state.strategyWeights.RED[k] = DEFAULT_STRATEGY_WEIGHT;
  }
  for (const k of ALL_BLU_STRATEGY_KEYS) {
    if (state.strategyWeights.BLU[k] == null) state.strategyWeights.BLU[k] = DEFAULT_STRATEGY_WEIGHT;
  }
}

export function clampStrategyWeight(w: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, w));
}

/** Bump weight for key no pool do roster (RED = chaves de ataque, BLU = chaves de defesa). */
export function bumpStrategyWeight(
  state: MatchState,
  side: "RED" | "BLU",
  key: string,
  delta: number
): void {
  ensureWeightKeys(state);
  const cur = state.strategyWeights[side][key] ?? DEFAULT_STRATEGY_WEIGHT;
  state.strategyWeights[side][key] = clampStrategyWeight(cur + delta);
}

export function weightedPick<T extends string>(
  keys: T[],
  weightOf: (k: T) => number,
  avoidSameAs: T | null,
  rerollChance: number
): T {
  const weights = keys.map((k) => Math.max(0.001, weightOf(k)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let pick = keys[0]!;
  for (let i = 0; i < keys.length; i++) {
    r -= weights[i]!;
    if (r <= 0) {
      pick = keys[i]!;
      break;
    }
  }
  if (avoidSameAs != null && pick === avoidSameAs && Math.random() < rerollChance && keys.length > 1) {
    const alts = keys.filter((k) => k !== avoidSameAs);
    pick = alts[Math.floor(Math.random() * alts.length)]!;
  }
  return pick;
}

export function redSideWonRound(state: MatchState, winner: TeamSide): boolean {
  return winner === getRedSideTeamFromState(state);
}

export function countRedSideEmergentConsecutiveWins(state: MatchState, key: string): number {
  let n = 0;
  for (let i = state.strategyHistory.length - 1; i >= 0; i--) {
    const h = state.strategyHistory[i]!;
    if (h.redSideStrategyKey !== key) break;
    if (h.redSideWon) n++;
    else break;
  }
  return n;
}

export function countBluSideEmergentConsecutiveWins(state: MatchState, key: string): number {
  let n = 0;
  for (let i = state.strategyHistory.length - 1; i >= 0; i--) {
    const h = state.strategyHistory[i]!;
    if (h.bluSideStrategyKey !== key) break;
    if (!h.redSideWon) n++;
    else break;
  }
  return n;
}

/** Garante no máximo `ACTIVE_CUSTOM_STRATEGY_CAP` custom ativas por lista (arquiva as piores). */
export function archiveExcessEmergentStrategies(state: MatchState): void {
  while (
    state.customRedStrategies.filter((c) => !c.archivedAtRound).length > ACTIVE_CUSTOM_STRATEGY_CAP
  ) {
    if (archiveWorstActiveCustom(state.customRedStrategies, state.round) == null) break;
  }
  while (
    state.customBluStrategies.filter((c) => !c.archivedAtRound).length > ACTIVE_CUSTOM_STRATEGY_CAP
  ) {
    if (archiveWorstActiveCustom(state.customBluStrategies, state.round) == null) break;
  }
}
