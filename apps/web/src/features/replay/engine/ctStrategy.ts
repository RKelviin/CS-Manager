/**
 * Estratégia CT por round: defensão dos bombsites.
 * Depende de economia, armamento e placar.
 *
 * Matriz situação → estratégia:
 * | Situação            | Estratégia                    |
 * |---------------------|-------------------------------|
 * | Round 1             | default                       |
 * | Eco + poucos rifles | stack no site de execução     |
 * | Deficit >= 2        | stack no site de execução     |
 * | Lead >= 2 + rifles  | aggressive                    |
 * | Lead + rifles       | hold (25%) ou default         |
 * | Pós-plant           | retake (definido em runtime)  |
 */
import { weaponKind } from "../ui/weaponIcons";
import type { BluStrategy, Bot, MatchState } from "../types";
import { TEAM_ECO_AVG_THRESHOLD } from "./economyConstants";
import { ROUNDS_TO_WIN_MATCH } from "./matchConstants";
import { getCtTeamFromState } from "./matchConstants";

/**
 * Escolhe estratégia de defesa CT para o round.
 * - default (3-2): padrão, 3 no site de execução TR, 2 no outro
 * - stack-a / stack-b: todos em um site (eco ou placar desfavorável)
 * - aggressive: push quando em vantagem
 * - hold: âncoras, menos rotação (quando em vantagem com rifles, 25% chance)
 */
export function chooseBluStrategyForRound(state: MatchState, ctBots: Bot[]): BluStrategy {
  const { score, round, tsExecuteSite } = state;
  const ctTeam = getCtTeamFromState(state);
  const ctScore = score[ctTeam];
  const trScore = score[ctTeam === "RED" ? "BLU" : "RED"];

  if (ctBots.length === 0) return "default";

  const igl = ctBots.find((b) => b.displayRole === "IGL" || b.role === "IGL");
  const decision = igl?.decision ?? 75;

  const avgMoney = ctBots.reduce((s, b) => s + b.money, 0) / ctBots.length;
  const rifles = ctBots.filter((b) => weaponKind(b.primaryWeapon) !== "pistol").length >= 3;

  const deficit = trScore - ctScore;
  const roundsToWin = ROUNDS_TO_WIN_MATCH - ctScore;

  if (round <= 1) return "default";

  if (avgMoney < TEAM_ECO_AVG_THRESHOLD && !rifles) {
    const stack = tsExecuteSite === "site-a" ? "stack-a" : "stack-b";
    if (state.bluStrategy === stack && Math.random() < 0.2) return "default";
    return stack;
  }

  if (deficit >= 2 && roundsToWin <= 4) {
    const stack = tsExecuteSite === "site-a" ? "stack-a" : "stack-b";
    if (state.bluStrategy === stack && Math.random() < 0.2) return "default";
    return stack;
  }

  if (ctScore >= trScore + 2 && rifles) {
    if (state.bluStrategy === "aggressive" && Math.random() < 0.25) return "default";
    return "aggressive";
  }

  if (ctScore >= trScore + 1 && rifles) {
    const holdChance = Math.max(0.1, Math.min(0.4, 0.15 + (decision - 50) / 200));
    if (Math.random() < holdChance) {
      if (state.bluStrategy === "hold" && Math.random() < 0.3) return "default";
      return "hold";
    }
  }

  return "default";
}

/** Site que o CT deve defender conforme estratégia e slot (0-4) */
export function getCtSiteForBot(
  slot: number,
  strategy: BluStrategy,
  tsExecuteSite: "site-a" | "site-b"
): "site-a" | "site-b" {
  if (strategy === "stack-a") return "site-a";
  if (strategy === "stack-b") return "site-b";
  if (strategy === "default" || strategy === "hold") {
    return slot < 3 ? tsExecuteSite : (tsExecuteSite === "site-a" ? "site-b" : "site-a");
  }
  return tsExecuteSite;
}

/** CT em estratégia de defesa (não aggressive/retake) — vai ao site atribuído */
export function isCtDefendStrategy(strategy: BluStrategy): boolean {
  return strategy === "default" || strategy === "stack-a" || strategy === "stack-b" || strategy === "hold";
}
