/**
 * Estratégia TR por round: rush, split, slow, default.
 * Depende de economia, armamento, placar e round (pistol vs full buy).
 */
import { weaponKind } from "../ui/weaponIcons";
import type { Bot, MatchState, RedStrategy } from "../types";
import { TEAM_ECO_AVG_THRESHOLD } from "./economyConstants";
import { FIRST_ROUND_SECOND_HALF, getCtTeamFromState, getTrTeamFromState } from "./matchConstants";

/**
 * Escolhe estratégia de ataque TR para o round.
 * - Pistol (round 1 ou 7): rush ou slow (pesos)
 * - Eco: default ou slow
 * - Full buy: rush, split, slow (por placar)
 * - Fallback: default
 */
export function chooseRedStrategyForRound(state: MatchState, trBots: Bot[]): RedStrategy {
  const { round, score } = state;
  const trTeam = getTrTeamFromState(state);
  const ctTeam = getCtTeamFromState(state);
  const trScore = score[trTeam];
  const ctScore = score[ctTeam];

  if (trBots.length === 0) return "default";

  const igl = trBots.find((b) => b.displayRole === "IGL" || b.role === "IGL");
  const decision = igl?.decision ?? 75;
  const optimalChance = Math.max(0.3, Math.min(0.95, 0.5 + (decision - 50) / 100));

  const avgMoney = trBots.reduce((s, b) => s + b.money, 0) / trBots.length;
  const rifles = trBots.filter((b) => weaponKind(b.primaryWeapon) !== "pistol").length;
  const isPistolRound = round === 1 || round === FIRST_ROUND_SECOND_HALF;

  if (isPistolRound) {
    const pick = Math.random() < 0.5 + (decision - 50) / 200 ? "rush" : "slow";
    if (state.redStrategy === pick && Math.random() < 0.3) return pick === "rush" ? "slow" : "rush";
    return pick;
  }

  if (avgMoney < TEAM_ECO_AVG_THRESHOLD && rifles < 3) {
    const pick = Math.random() < 0.5 ? "default" : "slow";
    if (state.redStrategy === pick && Math.random() < 0.3) return pick === "default" ? "slow" : "default";
    return pick;
  }

  if (rifles >= 4) {
    const deficit = ctScore - trScore;
    if (deficit >= 2) {
      if (state.redStrategy === "rush" && Math.random() < 0.25) return "split";
      return "rush";
    }
    if (trScore >= ctScore + 2) {
      const pick = Math.random() < 0.5 ? "split" : "slow";
      if (state.redStrategy === pick && Math.random() < 0.3) return pick === "split" ? "slow" : "split";
      return pick;
    }
    const picks: RedStrategy[] = ["rush", "split", "slow"];
    const idx = Math.floor(Math.random() * 3);
    let pick = picks[idx];
    if (state.redStrategy === pick && Math.random() < 0.3) {
      pick = picks[(idx + 1) % 3];
    }
    return pick;
  }

  return "default";
}
