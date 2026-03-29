import type { MatchState, TeamSide } from "../types";
import { getBluSideTeam, getRedSideTeam, getRedSideTeamFromState } from "./matchConstants";
import {
  archiveExcessEmergentStrategies,
  bumpStrategyWeight,
  countBluSideEmergentConsecutiveWins,
  countRedSideEmergentConsecutiveWins,
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

  const redSideRoster = getRedSideTeamFromState(state);
  const redSideWon = winner === redSideRoster;
  const redKey = state.activeRedSideStrategyKey ?? state.redStrategy;
  const bluKey = state.activeBluSideStrategyKey ?? state.bluStrategy;

  state.strategyHistory.push({
    round: state.round,
    redStrategy: state.redStrategy,
    bluStrategy: state.bluStrategy,
    redSideStrategyKey: redKey,
    bluSideStrategyKey: bluKey,
    winner,
    redSideWon,
    hadBombPlanted: state.bombPlanted,
    isEmergentRedSide: redKey.startsWith("emergent-"),
    isEmergentBluSide:
      bluKey.startsWith("emergent-blu-") || bluKey.startsWith("emergent-ct-")
  });

  const redRosterThisRound = getRedSideTeam(state.round, state.teamAStartsAs);
  const bluRosterThisRound = getBluSideTeam(state.round, state.teamAStartsAs);
  state.lastRoundEndAlive = {
    redSide: state.bots.filter((b) => b.team === redRosterThisRound && b.hp > 0).length,
    bluSide: state.bots.filter((b) => b.team === bluRosterThisRound && b.hp > 0).length
  };

  if (redSideWon) {
    bumpStrategyWeight(state, "RED", redKey, 0.15);
    bumpStrategyWeight(state, "BLU", bluKey, -0.08);
  } else {
    bumpStrategyWeight(state, "BLU", bluKey, 0.15);
    bumpStrategyWeight(state, "RED", redKey, -0.08);
  }

  const cr = state.customRedStrategies.find((c) => c.id === redKey);
  if (cr) {
    if (redSideWon) cr.stats.wins += 1;
    else cr.stats.losses += 1;
  }
  const cb = state.customBluStrategies.find((c) => c.id === bluKey);
  if (cb) {
    if (!redSideWon) cb.stats.wins += 1;
    else cb.stats.losses += 1;
  }

  if (redKey.startsWith("emergent-")) {
    const n = countRedSideEmergentConsecutiveWins(state, redKey);
    if (n >= 2) {
      const c = state.customRedStrategies.find((x) => x.id === redKey);
      if (c && !c.promoted) {
        c.promoted = true;
        bumpStrategyWeight(state, "RED", redKey, 0.2);
      }
    }
  }
  if (bluKey.startsWith("emergent-blu-") || bluKey.startsWith("emergent-ct-")) {
    const n = countBluSideEmergentConsecutiveWins(state, bluKey);
    if (n >= 2) {
      const c = state.customBluStrategies.find((x) => x.id === bluKey);
      if (c && !c.promoted) {
        c.promoted = true;
        bumpStrategyWeight(state, "BLU", bluKey, 0.2);
      }
    }
  }

  archiveExcessEmergentStrategies(state);
}
