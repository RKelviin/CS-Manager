import type { MatchState, TeamSide } from "../types";
import { getCtTeam, getTrTeam, getTrTeamFromState } from "./matchConstants";
import {
  archiveExcessEmergentStrategies,
  bumpStrategyWeight,
  countCtEmergentConsecutiveWins,
  countTrEmergentConsecutiveWins,
  defaultStrategyWeights,
  ensureWeightKeys
} from "./strategyLearning";

/** Após vencedor do round: histórico, pesos, stats de custom, promoção, arquivamento. */
export function recordRoundStrategyLearning(state: MatchState, winner: TeamSide): void {
  state.strategyHistory ??= [];
  state.strategyWeights ??= defaultStrategyWeights();
  state.customRedStrategies ??= [];
  state.customBluStrategies ??= [];
  ensureWeightKeys(state);

  const trTeam = getTrTeamFromState(state);
  const trWon = winner === trTeam;
  const trKey = state.activeTrStrategyKey ?? state.redStrategy;
  const ctKey = state.activeCtStrategyKey ?? state.bluStrategy;

  state.strategyHistory.push({
    round: state.round,
    redStrategy: state.redStrategy,
    bluStrategy: state.bluStrategy,
    trStrategyKey: trKey,
    ctStrategyKey: ctKey,
    winner,
    trWon,
    hadBombPlanted: state.bombPlanted,
    isEmergentTr: trKey.startsWith("emergent-"),
    isEmergentCt: ctKey.startsWith("emergent-ct-")
  });

  const trSide = getTrTeam(state.round, state.teamAStartsAs);
  const ctSide = getCtTeam(state.round, state.teamAStartsAs);
  state.lastRoundEndAlive = {
    tr: state.bots.filter((b) => b.team === trSide && b.hp > 0).length,
    ct: state.bots.filter((b) => b.team === ctSide && b.hp > 0).length
  };

  if (trWon) {
    bumpStrategyWeight(state, "RED", trKey, 0.15);
    bumpStrategyWeight(state, "BLU", ctKey, -0.08);
  } else {
    bumpStrategyWeight(state, "BLU", ctKey, 0.15);
    bumpStrategyWeight(state, "RED", trKey, -0.08);
  }

  const cr = state.customRedStrategies.find((c) => c.id === trKey);
  if (cr) {
    if (trWon) cr.stats.wins += 1;
    else cr.stats.losses += 1;
  }
  const cb = state.customBluStrategies.find((c) => c.id === ctKey);
  if (cb) {
    if (!trWon) cb.stats.wins += 1;
    else cb.stats.losses += 1;
  }

  if (trKey.startsWith("emergent-")) {
    const n = countTrEmergentConsecutiveWins(state, trKey);
    if (n >= 2) {
      const c = state.customRedStrategies.find((x) => x.id === trKey);
      if (c && !c.promoted) {
        c.promoted = true;
        bumpStrategyWeight(state, "RED", trKey, 0.2);
      }
    }
  }
  if (ctKey.startsWith("emergent-ct-")) {
    const n = countCtEmergentConsecutiveWins(state, ctKey);
    if (n >= 2) {
      const c = state.customBluStrategies.find((x) => x.id === ctKey);
      if (c && !c.promoted) {
        c.promoted = true;
        bumpStrategyWeight(state, "BLU", ctKey, 0.2);
      }
    }
  }

  archiveExcessEmergentStrategies(state);
}
