import type { MatchSetup } from "../types";
import { startersToPlayerData } from "./userTeamToMatchSetup";

/** Formato de jogador aceito (API ou BotPlayer) */
type TeamPlayer = {
  name: string;
  role: string;
  aim: number;
  reflex?: number;
  decision?: number;
  composure?: number;
  nationality?: string | null;
};

export type TeamInput = {
  name: string;
  starters: TeamPlayer[];
};

/** Converte dois times (com titulares) em MatchSetup para a simulação. */
export function teamsToMatchSetup(teamA: TeamInput, teamB: TeamInput): MatchSetup {
  const playerDataA = teamA.starters.length >= 5 ? startersToPlayerData(teamA.starters) : [];
  const playerDataB = teamB.starters.length >= 5 ? startersToPlayerData(teamB.starters) : [];

  const namesA = playerDataA.length >= 5 ? playerDataA.map((p) => p.name) : ["RED-1", "RED-2", "RED-3", "RED-4", "RED-5"];
  const namesB = playerDataB.length >= 5 ? playerDataB.map((p) => p.name) : ["BLU-1", "BLU-2", "BLU-3", "BLU-4", "BLU-5"];

  return {
    teamAName: teamA.name,
    teamBName: teamB.name,
    teamAPlayers: namesA,
    teamBPlayers: namesB,
    teamAStartsAs: "TR",
    teamAPlayerData: playerDataA.length >= 5 ? playerDataA : undefined,
    teamBPlayerData: playerDataB.length >= 5 ? playerDataB : undefined,
    matchType: "tournament"
  };
}
