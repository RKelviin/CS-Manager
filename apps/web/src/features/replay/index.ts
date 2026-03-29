/**
 * API pública da feature `replay` (simulação CS-style).
 *
 * - **Estado React**: `MatchProvider`, `useMatchContext`, `useMatch`
 * - **Simulação pura**: `simulation/*` (re-export abaixo)
 * - **Domínio**: `domain/teamModel` — roster RED/BLU vs papel RED/BLU por round
 * - **Mapas**: continuar importando de `./map/mapRegistry` ou `./map/mapTypes` até haver barrel dedicado
 */

export { MatchProvider, useMatchContext, useMatch } from "./state/MatchContext";
export { matchRegistry } from "./state/matchRegistry";
export type { StartMatchResult } from "./state/matchRegistry";

export * as simulation from "./simulation";

export {
  getBluSideTeam,
  getBluSideTeamFromState,
  getTeamDisplayColor,
  getRedSideTeam,
  getRedSideTeamFromState,
  RED_SIDE_DISPLAY_COLORS,
  BLU_SIDE_DISPLAY_COLORS,
  teamSideIsRedSide,
  teamSideIsBluSide,
  botIsRedSide,
  botIsBluSide,
  redSideTeamForRound,
  bluSideTeamForRound
} from "./domain/teamModel";
export type { TeamSide } from "./domain/teamModel";

export type { MatchSetup, MatchState, MatchEvent, Bot, MatchType, StartsAsSide } from "./types";

export { createMatchState } from "./engine/createMatchState";
export { matchReducer, getDecisionOrder } from "./engine/matchReducer";
