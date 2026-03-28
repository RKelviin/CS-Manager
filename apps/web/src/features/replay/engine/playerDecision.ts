/**
 * Módulo de decisão por jogador.
 * Interface única: recebe view, aplica decisão de movimento no bot.
 */
import { applySituationalMovement } from "./situationalBrain";
import type { Bot, MatchState } from "../types";
import type { PlayerView } from "./playerView";

/** Aplica decisão de movimento ao bot (alvo targetX/targetY). A mira é aplicada em aimAtThreats. */
export function applyPlayerDecision(bot: Bot, state: MatchState, view: PlayerView): void {
  applySituationalMovement(bot, state, view);
}
