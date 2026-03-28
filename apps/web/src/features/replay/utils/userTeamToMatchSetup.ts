import type { MatchSetup, MatchPlayerData, PlayerRole } from "../types";
import type { BotPlayer } from "../../team/types";

/** Mapeia role do time para role da simulação */
export const toSimRole = (role: string): PlayerRole => {
  if (role === "Sniper") return "AWP";
  if (role === "IGL") return "IGL";
  return "Rifler";
};

/** Converte 5 titulares em MatchPlayerData mantendo ordem e mapeando roles. */
export const startersToPlayerData = (
  starters: Array<{
    name: string;
    role: string;
    aim: number;
    reflex?: number;
    decision?: number;
    composure?: number;
    nationality?: string | null;
  }>
): MatchPlayerData[] =>
  starters.slice(0, 5).map((p) => ({
    name: p.name,
    aim: p.aim,
    role: toSimRole(p.role),
    displayRole: p.role,
    nationality: p.nationality ?? undefined,
    reflex: p.reflex,
    decision: p.decision,
    composure: p.composure
  }));

/** Nacionalidades padrão para o time BOT (variadas) */
const DEFAULT_BOT_NATIONALITIES = ["US", "RU", "SE", "PL", "DK"] as const;

/** Converte o time do usuário em MatchSetup. Seu time = RED (team A). Oponente = BLU (team B) com valores padrão. */
export const userTeamToMatchSetup = (
  teamName: string,
  starters: BotPlayer[],
  opponentName = "BOT"
): MatchSetup => {
  const playerData = starters.length >= 5 ? startersToPlayerData(starters) : [];
  const teamBPlayerData: MatchPlayerData[] = [
    { name: "BOT-1", aim: 74, role: "Rifler", displayRole: "Entry", nationality: DEFAULT_BOT_NATIONALITIES[0] },
    { name: "BOT-2", aim: 78, role: "AWP", displayRole: "Sniper", nationality: DEFAULT_BOT_NATIONALITIES[1] },
    { name: "BOT-3", aim: 72, role: "Rifler", displayRole: "Support", nationality: DEFAULT_BOT_NATIONALITIES[2] },
    { name: "BOT-4", aim: 76, role: "Rifler", displayRole: "Lurker", nationality: DEFAULT_BOT_NATIONALITIES[3] },
    { name: "BOT-5", aim: 68, role: "IGL", displayRole: "IGL", nationality: DEFAULT_BOT_NATIONALITIES[4] }
  ];

  return {
    teamAName: teamName,
    teamBName: opponentName,
    teamAPlayers: playerData.length >= 5 ? playerData.map((p) => p.name) : ["RED-1", "RED-2", "RED-3", "RED-4", "RED-5"],
    teamBPlayers: ["BOT-1", "BOT-2", "BOT-3", "BOT-4", "BOT-5"],
    teamAStartsAs: "TR",
    teamAPlayerData: playerData.length >= 5 ? playerData : undefined,
    teamBPlayerData
  };
};
