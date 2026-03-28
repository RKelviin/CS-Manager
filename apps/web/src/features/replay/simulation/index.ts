/**
 * Camada de simulação — ponto único para o motor (reducer + estado inicial + ritmo de tick).
 * O registry e hooks devem importar daqui para manter um único contrato ao evoluir a engine.
 */
export { matchReducer, getDecisionOrder } from "../engine/matchReducer";
export { matchReducer as reduceMatch } from "../engine/matchReducer";
export { createMatchState } from "../engine/createMatchState";
export { createMatchState as createInitialMatchState } from "../engine/createMatchState";
export { applyPendingRoundAdvance, snapshotBotsForAdvance } from "../engine/roundAdvance";

/** Intervalo padrão do tick em ms (registry + useMatchSimulation) */
export const SIMULATION_TICK_MS = 100;

export type { MatchEvent, MatchState, MatchSetup, Bot, TeamSide } from "../types";
