/**
 * Modelo de identidade vs. papel tático na simulação
 * -------------------------------------------------
 *
 * - **TeamSide (`RED` | `BLU`)**: identidade fixa da equipe (HUD, `red-*` / `blu-*`, score).
 *   Time A do setup = RED, time B = BLU (`MatchSetup.teamAName` / `teamBName`).
 *
 * - **Papel por round (RED ataque / BLU defesa)**: quem ataca com C4 vs defende; alterna no halftime e em blocos de OT.
 *   Deriva de `round` + `teamAStartsAs` via `getRedSideTeam` / `getBluSideTeam`.
 *
 * - **Cores na UI**: vermelho = papel RED no round atual, azul = papel BLU (`getTeamDisplayColor`), não confundir com TeamSide.
 *
 * Para lógica de jogo, prefira `getRedSideTeamFromState` / `getBluSideTeamFromState` ou os helpers abaixo.
 */
import type { MatchState, TeamSide } from "../types";
import { getBluSideTeam, getBluSideTeamFromState, getRedSideTeam, getRedSideTeamFromState } from "../engine/matchConstants";

export type { TeamSide };

export {
  getBluSideTeam,
  getBluSideTeamFromState,
  getTeamDisplayColor,
  getRedSideTeam,
  getRedSideTeamFromState,
  RED_SIDE_DISPLAY_COLORS,
  BLU_SIDE_DISPLAY_COLORS
} from "../engine/matchConstants";

/** O `TeamSide` está no papel RED (ataque) neste estado de partida? */
export const teamSideIsRedSide = (team: TeamSide, state: Pick<MatchState, "round" | "teamAStartsAs">): boolean =>
  team === getRedSideTeamFromState(state);

/** O `TeamSide` está no papel BLU (defesa) neste estado de partida? */
export const teamSideIsBluSide = (team: TeamSide, state: Pick<MatchState, "round" | "teamAStartsAs">): boolean =>
  team === getBluSideTeamFromState(state);

/** Bot no papel RED neste round (independente de ser roster RED ou BLU)? */
export const botIsRedSide = (bot: { team: TeamSide }, state: Pick<MatchState, "round" | "teamAStartsAs">): boolean =>
  teamSideIsRedSide(bot.team, state);

/** Bot no papel BLU neste round? */
export const botIsBluSide = (bot: { team: TeamSide }, state: Pick<MatchState, "round" | "teamAStartsAs">): boolean =>
  teamSideIsBluSide(bot.team, state);

/** Roster no papel RED para um número de round explícito (testes / pré-visualização). */
export const redSideTeamForRound = (
  round: number,
  teamAStartsAs: MatchState["teamAStartsAs"]
): TeamSide => getRedSideTeam(round, teamAStartsAs);

/** Roster no papel BLU para um número de round explícito. */
export const bluSideTeamForRound = (
  round: number,
  teamAStartsAs: MatchState["teamAStartsAs"]
): TeamSide => getBluSideTeam(round, teamAStartsAs);
