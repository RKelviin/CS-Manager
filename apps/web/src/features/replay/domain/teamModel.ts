/**
 * Modelo de identidade vs. papel tático na simulação
 * -------------------------------------------------
 *
 * - **TeamSide (`RED` | `BLU`)**: identidade fixa da equipe (HUD, `red-*` / `blu-*`, score).
 *   Time A do setup = RED, time B = BLU (`MatchSetup.teamAName` / `teamBName`).
 *
 * - **Papel por round (TR vs CT)**: quem ataca com C4 vs defende; alterna no halftime e em blocos de OT.
 *   Deriva de `round` + `teamAStartsAs` via `getTrTeam` / `getCtTeam`.
 *
 * - **Cores na UI**: laranja = TR no round atual, azul = CT (`getTeamDisplayColor`), não confundir com TeamSide.
 *
 * Para lógica de jogo, prefira `getTrTeamFromState` / `getCtTeamFromState` ou os helpers abaixo.
 */
import type { MatchState, TeamSide } from "../types";
import { getCtTeam, getCtTeamFromState, getTrTeam, getTrTeamFromState } from "../engine/matchConstants";

export type { TeamSide };

export {
  getCtTeam,
  getCtTeamFromState,
  getTeamDisplayColor,
  getTrTeam,
  getTrTeamFromState,
  TR_DISPLAY_COLORS,
  CT_DISPLAY_COLORS
} from "../engine/matchConstants";

/** O `TeamSide` joga como TR neste estado de partida? */
export const teamSideIsTr = (team: TeamSide, state: Pick<MatchState, "round" | "teamAStartsAs">): boolean =>
  team === getTrTeamFromState(state);

/** O `TeamSide` joga como CT neste estado de partida? */
export const teamSideIsCt = (team: TeamSide, state: Pick<MatchState, "round" | "teamAStartsAs">): boolean =>
  team === getCtTeamFromState(state);

/** Bot no papel TR neste round (independente de ser RED ou BLU)? */
export const botIsTr = (bot: { team: TeamSide }, state: Pick<MatchState, "round" | "teamAStartsAs">): boolean =>
  teamSideIsTr(bot.team, state);

/** Bot no papel CT neste round? */
export const botIsCt = (bot: { team: TeamSide }, state: Pick<MatchState, "round" | "teamAStartsAs">): boolean =>
  teamSideIsCt(bot.team, state);

/** TR/CT para um número de round explícito (útil em testes ou pré-visualização). */
export const trTeamForRound = (
  round: number,
  teamAStartsAs: MatchState["teamAStartsAs"]
): TeamSide => getTrTeam(round, teamAStartsAs);

export const ctTeamForRound = (
  round: number,
  teamAStartsAs: MatchState["teamAStartsAs"]
): TeamSide => getCtTeam(round, teamAStartsAs);
