/**
 * Estratégia do papel BLU (defesa) por round: bombsites.
 * Depende de economia, armamento e placar.
 * Pesos aprendidos + emergentes.
 */
import { weaponKind } from "../ui/weaponIcons";
import type { BluStrategy, Bot, MatchState } from "../types";
import { TEAM_ECO_AVG_THRESHOLD } from "./economyConstants";
import { ROUNDS_TO_WIN_MATCH } from "./matchConstants";
import { getBluSideTeamFromState } from "./matchConstants";
import {
  ALL_BLU_STRATEGY_KEYS,
  BLU_BASE_KEYS_PRE_PLANT_EMERGENT,
  DEFAULT_STRATEGY_WEIGHT,
  ensureRoomForNewEmergentCustom,
  ensureWeightKeys,
  weightedPick
} from "./strategyLearning";

export type BluSideStrategyChoice = {
  strategy: BluStrategy;
  bluSideStrategyKey: string;
  isEmergent: boolean;
};

const isBluStrategy = (s: string): s is BluStrategy =>
  (ALL_BLU_STRATEGY_KEYS as string[]).includes(s);

function createEmergentCtCombo(state: MatchState): string | null {
  ensureRoomForNewEmergentCustom(state.customBluStrategies, state.round);
  const active = state.customBluStrategies.filter((c) => !c.archivedAtRound);
  if (active.length >= 5) return null;

  const pool = [...BLU_BASE_KEYS_PRE_PLANT_EMERGENT];
  const a = pool[Math.floor(Math.random() * pool.length)]!;
  let b = pool[Math.floor(Math.random() * pool.length)]!;
  let guard = 0;
  while (b === a && guard++ < 8) b = pool[Math.floor(Math.random() * pool.length)]!;

  const id = `emergent-blu-${a}-${b}-r${state.round}`;
  if (state.customBluStrategies.some((c) => c.id === id)) return null;

  const name = `${a} + ${b}`;
  state.customBluStrategies.push({
    id,
    name,
    baseType: a,
    createdAtRound: state.round,
    stats: { wins: 0, losses: 0 }
  });
  ensureWeightKeys(state);
  state.strategyWeights.BLU[id] = DEFAULT_STRATEGY_WEIGHT;
  return id;
}

function resolveCtPickFromKey(state: MatchState, key: string, isEmergent: boolean): BluSideStrategyChoice {
  const custom = state.customBluStrategies.find((c) => c.id === key);
  if (custom && !custom.archivedAtRound) {
    return { strategy: custom.baseType, bluSideStrategyKey: key, isEmergent };
  }
  if (isBluStrategy(key)) {
    return { strategy: key, bluSideStrategyKey: key, isEmergent: false };
  }
  return { strategy: "default", bluSideStrategyKey: "default", isEmergent: false };
}

function lastHistory(state: MatchState) {
  const h = state.strategyHistory;
  return h.length > 0 ? h[h.length - 1]! : null;
}

function trUsedRushLastTwoRounds(state: MatchState): boolean {
  const tail = state.strategyHistory.slice(-2);
  return tail.length >= 2 && tail.every((h) => h.redStrategy === "rush");
}

function trUsedFakeLastRound(state: MatchState): boolean {
  const prev = lastHistory(state);
  return prev?.redStrategy === "fake";
}

/**
 * Escolhe estratégia do papel BLU (defesa) para o round.
 */
export function chooseBluStrategyForRound(state: MatchState, ctBots: Bot[]): BluSideStrategyChoice {
  const { score, round, tsExecuteSite } = state;
  const ctTeam = getBluSideTeamFromState(state);
  const ctScore = score[ctTeam];
  const trScore = score[ctTeam === "RED" ? "BLU" : "RED"];

  const finish = (strategy: BluStrategy): BluSideStrategyChoice => ({
    strategy,
    bluSideStrategyKey: strategy,
    isEmergent: false
  });

  if (ctBots.length === 0) return finish("default");

  const aliveCts = ctBots.filter((b) => b.hp > 0);
  if (state.bombPlanted && state.bombPlantSite) {
    const rifles = aliveCts.filter((b) => weaponKind(b.primaryWeapon) !== "pistol").length >= 3;
    if (rifles) {
      const lateRotate =
        state.bombPlantSite !== tsExecuteSite || state.redStrategy === "fake";
      if (aliveCts.length >= 3 && lateRotate) return finish("rotate");
      return finish("retake");
    }
    return finish("retake");
  }

  const igl = ctBots.find((b) => b.displayRole === "IGL" || b.role === "IGL");
  const decision = igl?.decision ?? 75;

  const avgMoney = ctBots.reduce((s, b) => s + b.money, 0) / ctBots.length;
  const rifles = ctBots.filter((b) => weaponKind(b.primaryWeapon) !== "pistol").length >= 3;

  const deficit = trScore - ctScore;
  const roundsToWin = ROUNDS_TO_WIN_MATCH - ctScore;

  if (round <= 1) return finish("default");

  if (avgMoney < TEAM_ECO_AVG_THRESHOLD && !rifles) {
    const stack = tsExecuteSite === "site-a" ? "stack-a" : "stack-b";
    if (state.bluStrategy === stack && Math.random() < 0.2) return finish("default");
    return finish(stack);
  }

  if (deficit >= 2 && roundsToWin <= 4) {
    const stack = tsExecuteSite === "site-a" ? "stack-a" : "stack-b";
    if (state.bluStrategy === stack && Math.random() < 0.2) return finish("default");
    return finish(stack);
  }

  if (ctScore >= trScore + 2 && rifles) {
    if (state.bluStrategy === "aggressive" && Math.random() < 0.25) return finish("default");
    return finish("aggressive");
  }

  if (ctScore >= trScore + 1 && rifles) {
    const holdChance = Math.max(0.1, Math.min(0.4, 0.15 + (decision - 50) / 200));
    if (Math.random() < holdChance) {
      if (state.bluStrategy === "hold" && Math.random() < 0.3) return finish("default");
      return finish("hold");
    }
  }

  ensureWeightKeys(state);

  if (round % 3 === 0 && Math.random() < 0.12) {
    createEmergentCtCombo(state);
  }

  const poolBlu: BluStrategy[] = ["default", "stack-a", "stack-b", "aggressive", "hold", "rotate"];
  const weights: Record<string, number> = {};
  for (const k of poolBlu) weights[k] = 1;

  if (trUsedRushLastTwoRounds(state)) {
    const stackKey = tsExecuteSite === "site-a" ? "stack-a" : "stack-b";
    weights[stackKey] = (weights[stackKey] ?? 1) + 0.45;
  }
  if (trUsedFakeLastRound(state)) {
    weights.default = (weights.default ?? 1) + 0.35;
  }
  if (Math.abs(ctScore - trScore) <= 1) {
    weights.aggressive = (weights.aggressive ?? 1) * 0.65;
  }

  const customKeys = state.customBluStrategies
    .filter((c) => !c.archivedAtRound && c.baseType !== "retake")
    .map((c) => c.id);
  const poolKeys = [...poolBlu, ...customKeys];

  const pickKey = weightedPick(
    poolKeys,
    (k) => {
      if (poolBlu.includes(k as BluStrategy)) {
        const base = weights[k] ?? 1;
        const learned = state.strategyWeights.BLU[k] ?? DEFAULT_STRATEGY_WEIGHT;
        return base * learned;
      }
      return state.strategyWeights.BLU[k] ?? DEFAULT_STRATEGY_WEIGHT;
    },
    state.activeBluSideStrategyKey,
    0.25
  );

  const isEmergent =
    pickKey.startsWith("emergent-blu-") || pickKey.startsWith("emergent-ct-");
  const choice = resolveCtPickFromKey(state, pickKey, isEmergent);
  if (!state.bombPlanted && choice.strategy === "retake") {
    return finish("default");
  }
  return choice;
}

/** Site que o papel BLU deve defender conforme estratégia e slot (0-4) */
export function getBluSiteForBot(
  slot: number,
  strategy: BluStrategy,
  tsExecuteSite: "site-a" | "site-b",
  bombPlantSite: "site-a" | "site-b" | null = null
): "site-a" | "site-b" {
  if (strategy === "stack-a") return "site-a";
  if (strategy === "stack-b") return "site-b";
  if (strategy === "rotate") {
    const planted = bombPlantSite ?? tsExecuteSite;
    return slot < 2 ? planted : planted === "site-a" ? "site-b" : "site-a";
  }
  if (strategy === "default" || strategy === "hold") {
    return slot < 3 ? tsExecuteSite : tsExecuteSite === "site-a" ? "site-b" : "site-a";
  }
  return tsExecuteSite;
}

/** Papel BLU em estratégia de defesa (não aggressive/retake) — vai ao site atribuído */
export function isBluSideDefendStrategy(strategy: BluStrategy): boolean {
  return (
    strategy === "default" ||
    strategy === "stack-a" ||
    strategy === "stack-b" ||
    strategy === "hold" ||
    strategy === "rotate"
  );
}
