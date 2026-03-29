/**
 * Estratégia do papel RED (ataque) por round: rush, split, slow, default.
 * Depende de economia, armamento, placar e round (pistol vs full buy).
 * Pesos aprendidos + emergentes (combinações).
 */
import { weaponKind } from "../ui/weaponIcons";
import type { Bot, MatchState, RedStrategy } from "../types";
import { TEAM_ECO_AVG_THRESHOLD } from "./economyConstants";
import { FIRST_ROUND_SECOND_HALF, getBluSideTeamFromState, getRedSideTeamFromState } from "./matchConstants";
import {
  ALL_RED_STRATEGY_KEYS,
  DEFAULT_STRATEGY_WEIGHT,
  ensureRoomForNewEmergentCustom,
  ensureWeightKeys,
  weightedPick
} from "./strategyLearning";

export type RedSideStrategyChoice = {
  strategy: RedStrategy;
  redSideStrategyKey: string;
  isEmergent: boolean;
};

const isRedStrategy = (s: string): s is RedStrategy =>
  (ALL_RED_STRATEGY_KEYS as string[]).includes(s);

const trAliveCount = (state: MatchState) =>
  state.bots.filter((b) => b.team === getRedSideTeamFromState(state) && b.hp > 0).length;

const ctAliveCount = (state: MatchState) =>
  state.bots.filter((b) => b.team === getBluSideTeamFromState(state) && b.hp > 0).length;

function createEmergentTrCombo(state: MatchState): string | null {
  ensureRoomForNewEmergentCustom(state.customRedStrategies, state.round);
  const active = state.customRedStrategies.filter((c) => !c.archivedAtRound);
  if (active.length >= 5) return null;

  const pool = [...ALL_RED_STRATEGY_KEYS];
  const a = pool[Math.floor(Math.random() * pool.length)]!;
  let b = pool[Math.floor(Math.random() * pool.length)]!;
  let guard = 0;
  while (b === a && guard++ < 8) b = pool[Math.floor(Math.random() * pool.length)]!;

  const id = `emergent-${a}-${b}-r${state.round}`;
  if (state.customRedStrategies.some((c) => c.id === id)) return null;

  const name = `${a[0]!.toUpperCase() + a.slice(1)} ${b[0]!.toUpperCase() + b.slice(1)}`;
  state.customRedStrategies.push({
    id,
    name,
    baseType: a,
    createdAtRound: state.round,
    stats: { wins: 0, losses: 0 }
  });
  ensureWeightKeys(state);
  state.strategyWeights.RED[id] = DEFAULT_STRATEGY_WEIGHT;
  return id;
}

function resolveTrPickFromKey(state: MatchState, key: string, isEmergent: boolean): RedSideStrategyChoice {
  const custom = state.customRedStrategies.find((c) => c.id === key);
  if (custom && !custom.archivedAtRound) {
    return { strategy: custom.baseType, redSideStrategyKey: key, isEmergent };
  }
  if (isRedStrategy(key)) {
    return { strategy: key, redSideStrategyKey: key, isEmergent: false };
  }
  return { strategy: "default", redSideStrategyKey: "default", isEmergent: false };
}

function lastHistory(state: MatchState) {
  const h = state.strategyHistory;
  return h.length > 0 ? h[h.length - 1]! : null;
}

function trHadBombPlantPreviousRound(state: MatchState): boolean {
  const prev = lastHistory(state);
  return prev?.hadBombPlanted === true;
}

function lastTrRoundWasFakeAndLost(state: MatchState): boolean {
  const prev = lastHistory(state);
  if (!prev) return false;
  const trTeam = getRedSideTeamFromState(state);
  return prev.redStrategy === "fake" && prev.winner !== trTeam;
}

function applyTrContextWeights(
  state: MatchState,
  base: Record<string, number>,
  trBots: Bot[]
): Record<string, number> {
  const w = { ...base };
  const redAlive = state.lastRoundEndAlive?.redSide ?? trAliveCount(state);
  const bluAlive = state.lastRoundEndAlive?.bluSide ?? ctAliveCount(state);
  if (bluAlive > 0 && redAlive > bluAlive) {
    w.rush = (w.rush ?? 1) + 0.3;
  }
  if (trHadBombPlantPreviousRound(state)) {
    w.slow = (w.slow ?? 1) + 0.25;
  }
  if (lastTrRoundWasFakeAndLost(state)) {
    w.fake = Math.max(0.05, (w.fake ?? 1) - 0.2);
  }
  const avgMoney = trBots.reduce((s, b) => s + b.money, 0) / Math.max(1, trBots.length);
  const rifles = trBots.filter((b) => weaponKind(b.primaryWeapon) !== "pistol").length;
  if (avgMoney < TEAM_ECO_AVG_THRESHOLD && rifles >= 3) {
    return { rush: 1, split: 0.01, slow: 0.01, default: 0.01, fake: 0.01 };
  }
  return w;
}

/**
 * Escolhe estratégia do papel RED (ataque) para o round.
 */
export function chooseRedStrategyForRound(state: MatchState, trBots: Bot[]): RedSideStrategyChoice {
  const { round, score } = state;
  const trTeam = getRedSideTeamFromState(state);
  const ctTeam = getBluSideTeamFromState(state);
  const trScore = score[trTeam];
  const ctScore = score[ctTeam];

  if (trBots.length === 0) return { strategy: "default", redSideStrategyKey: "default", isEmergent: false };

  const igl = trBots.find((b) => b.displayRole === "IGL" || b.role === "IGL");

  const avgMoney = trBots.reduce((s, b) => s + b.money, 0) / trBots.length;
  const rifles = trBots.filter((b) => weaponKind(b.primaryWeapon) !== "pistol").length;
  const isPistolRound = round === 1 || round === FIRST_ROUND_SECOND_HALF;

  const finish = (strategy: RedStrategy): RedSideStrategyChoice => ({
    strategy,
    redSideStrategyKey: strategy,
    isEmergent: false
  });

  if (isPistolRound) {
    const decision = igl?.decision ?? 75;
    const pick = Math.random() < 0.5 + (decision - 50) / 200 ? "rush" : "slow";
    if (state.redStrategy === pick && Math.random() < 0.3) {
      return finish(pick === "rush" ? "slow" : "rush");
    }
    return finish(pick);
  }

  if (avgMoney < TEAM_ECO_AVG_THRESHOLD && rifles < 3) {
    const pick = Math.random() < 0.5 ? "default" : "slow";
    if (state.redStrategy === pick && Math.random() < 0.3) {
      return finish(pick === "default" ? "slow" : "default");
    }
    return finish(pick);
  }

  if (rifles >= 4) {
    const deficit = ctScore - trScore;
    if (deficit >= 2) {
      if (state.redStrategy === "rush" && Math.random() < 0.25) return finish("split");
      return finish("rush");
    }
    if (trScore >= ctScore + 2) {
      const pick = Math.random() < 0.5 ? "split" : "slow";
      if (state.redStrategy === pick && Math.random() < 0.3) {
        return finish(pick === "split" ? "slow" : "split");
      }
      return finish(pick);
    }

    ensureWeightKeys(state);

    if (round % 3 === 0 && Math.random() < 0.12) {
      createEmergentTrCombo(state);
    }

    const strats: RedStrategy[] = ["rush", "split", "slow", "fake"];
    const decision = igl?.decision ?? 75;
    const fakeWeight = Math.max(0, ((decision - 50) / 50) * 0.85);

    const baseWeights: Record<string, number> = {
      rush: 1,
      split: 1,
      slow: 1,
      fake: fakeWeight
    };
    const ctx = applyTrContextWeights(state, baseWeights, trBots);

    const customKeys = state.customRedStrategies
      .filter((c) => !c.archivedAtRound)
      .map((c) => c.id);
    const poolKeys = [...strats, ...customKeys];

    const pickKey = weightedPick(
      poolKeys,
      (k) => {
        if (strats.includes(k as RedStrategy)) {
          const base = ctx[k] ?? 1;
          const learned = state.strategyWeights.RED[k] ?? DEFAULT_STRATEGY_WEIGHT;
          return base * learned;
        }
        return state.strategyWeights.RED[k] ?? DEFAULT_STRATEGY_WEIGHT;
      },
      state.activeRedSideStrategyKey,
      0.3
    );

    const isEmergent = pickKey.startsWith("emergent-");
    return resolveTrPickFromKey(state, pickKey, isEmergent);
  }

  return finish("default");
}
