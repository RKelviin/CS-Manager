/**
 * Campeonatos eliminatórios: 2, 4, 8 times.
 * Usuário inscreve seu time; resto preenchido com NPCs.
 * Formato: mata-mata (single elimination).
 */
import { prisma } from "../../db/index.js";

const SYSTEM_USER_EMAIL = "system@csm.league";

export type ChampionshipTemplate = {
  format: 2 | 4 | 8;
  name: string;
  description: string;
  prizes: number[];
  matchCount: number;
};

export const CHAMPIONSHIP_TEMPLATES: ChampionshipTemplate[] = [
  { format: 2, name: "Duelo", description: "Final direta entre 2 times", prizes: [800, 400], matchCount: 1 },
  { format: 4, name: "Copa 4 Times", description: "Semi-finais + final + disputa do 3º lugar", prizes: [1500, 800, 400], matchCount: 4 },
  { format: 8, name: "Copa 8 Times", description: "Quartas + semi-finais + final + disputa do 3º lugar", prizes: [3000, 1500, 800, 400], matchCount: 8 }
];

type BracketState = {
  teamIds: string[];
  roundMatchIds: string[][];
  roundConfigs: Array<{ sourceMatchIndices?: number[] }>;
};

/** Retorna templates disponíveis */
export function getChampionshipTemplates(): ChampionshipTemplate[] {
  return CHAMPIONSHIP_TEMPLATES;
}

/** Gera configuração do bracket para N times (eliminatória simples) */
function getBracketConfig(format: 2 | 4 | 8): { roundPairs: number[][][]; roundSources: number[][][] } {
  if (format === 2) {
    return { roundPairs: [[[0, 1]]], roundSources: [] };
  }
  if (format === 4) {
    return {
      roundPairs: [[[0, 1], [2, 3]]],
      roundSources: [[[0, 1]]]
    };
  }
  if (format === 8) {
    return {
      roundPairs: [[[0, 1], [2, 3], [4, 5], [6, 7]]],
      roundSources: [[[0, 1], [2, 3]], [[0, 1]]]
    };
  }
  throw new Error(`Unsupported format: ${format}`);
}

/** Cria campeonato: inscreve time do usuário + NPCs, gera partidas da 1ª rodada */
export async function startChampionship(userId: string, format: 2 | 4 | 8) {
  const systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
  if (!systemUser) throw new Error("Sistema não configurado. Execute db:seed.");

  const userTeams = await prisma.team.findMany({
    where: { userId },
    include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } }
  });
  const userTeam = userTeams[0];
  if (!userTeam || userTeam.players.length < 5) {
    throw new Error("Você precisa de um time com 5 titulares para participar.");
  }

  const npcTeams = await prisma.team.findMany({
    where: { userId: systemUser.id },
    include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } }
  });
  if (npcTeams.length < format - 1) {
    throw new Error(`Faltam times NPC. Execute db:seed (precisa de ${format} times).`);
  }

  const shuffled = [...npcTeams].sort(() => Math.random() - 0.5);
  const allTeams = [userTeam, ...shuffled.slice(0, format - 1)];
  const teamIds = allTeams.map((t) => t.id);

  const template = CHAMPIONSHIP_TEMPLATES.find((t) => t.format === format)!;
  const { roundPairs, roundSources } = getBracketConfig(format);

  const bracketState: BracketState = {
    teamIds,
    roundMatchIds: [],
    roundConfigs: roundSources.flatMap((r) => r.map((sources) => ({ sourceMatchIndices: sources })))
  };

  const season = await prisma.season.create({
    data: {
      userId,
      name: template.name,
      status: "active",
      championshipFormat: format,
      bracketState: bracketState as unknown as object
    }
  });

  for (let r = 0; r < roundPairs.length; r++) {
    const pairs = roundPairs[r];
    const roundMatchIds: string[] = [];
    for (const [aIdx, bIdx] of pairs) {
      const match = await prisma.match.create({
        data: {
          seasonId: season.id,
          round: r + 1,
          teamAId: teamIds[aIdx],
          teamBId: teamIds[bIdx],
          matchType: "tournament"
        }
      });
      roundMatchIds.push(match.id);
    }
    bracketState.roundMatchIds.push(roundMatchIds);
  }

  await prisma.season.update({
    where: { id: season.id },
    data: { bracketState: bracketState as unknown as object }
  });

  return prisma.season.findUnique({
    where: { id: season.id },
    include: {
      matches: { include: { teamA: true, teamB: true, winner: true } }
    }
  })!;
}

/** Lista campeonatos do usuário (seasons com championshipFormat) */
export async function listChampionshipRuns(userId: string) {
  const seasons = await prisma.season.findMany({
    where: { userId, championshipFormat: { not: null } },
    include: {
      matches: {
        include: { teamA: true, teamB: true, winner: true },
        orderBy: { round: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const template = CHAMPIONSHIP_TEMPLATES;
  return seasons.map((s) => ({
    id: s.id,
    name: s.name,
    format: s.championshipFormat,
    status: s.status,
    matchCount: s.matches.length,
    matches: s.matches,
    prizes: template.find((t) => t.format === s.championshipFormat)?.prizes ?? []
  }));
}

/** Obtém um campeonato com partidas */
export async function getChampionshipRun(seasonId: string, userId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      matches: {
        include: {
          teamA: { include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } } },
          teamB: { include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } } },
          winner: true
        },
        orderBy: [{ round: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!season || season.userId !== userId) throw new Error("Campeonato não encontrado");
  if (!season.championshipFormat) throw new Error("Não é um campeonato");
  const template = CHAMPIONSHIP_TEMPLATES.find((t) => t.format === season.championshipFormat);
  return {
    ...season,
    prizes: template?.prizes ?? [],
    template
  };
}

/** Para cada rodada, pares de índices: [0,1] = próximo match é vencedor de match 0 e 1 */
const BRACKET_PAIRS: Record<number, number[][][]> = {
  2: [],
  4: [[[0, 1]]],
  8: [[[0, 1], [2, 3]], [[0, 1]]]
};

/** Formatos que têm semi-finais (2 partidas) e portanto disputa do 3º lugar */
const HAS_THIRD_PLACE = { 4: true, 8: true } as const;

/** Após partida finalizada: verifica se deve criar próxima rodada do bracket */
export async function advanceChampionshipBracket(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { season: true }
  });
  if (!match || !match.season.championshipFormat || !match.season.bracketState) return;

  const format = match.season.championshipFormat as 2 | 4 | 8;
  const state = match.season.bracketState as BracketState;
  if (!state.roundMatchIds || state.roundMatchIds.length === 0) return;

  const roundIndex = state.roundMatchIds.findIndex((ids) => ids.includes(matchId));
  if (roundIndex < 0) return;

  const roundPairs = BRACKET_PAIRS[format]?.[roundIndex];
  if (!roundPairs) return;

  const currentRoundIds = state.roundMatchIds[roundIndex] ?? [];
  const matchIdx = currentRoundIds.indexOf(matchId);
  if (matchIdx < 0) return;

  const pair = roundPairs.find(([a, b]) => a === matchIdx || b === matchIdx);
  if (!pair) return;

  const sourceMatchIds = pair.map((i) => currentRoundIds[i]);
  const sourceMatches = await prisma.match.findMany({
    where: { id: { in: sourceMatchIds } },
    select: { winnerId: true, teamAId: true, teamBId: true }
  });
  if (sourceMatches.some((m) => !m.winnerId)) return;

  const winnerIds = sourceMatches.map((m) => m.winnerId!);
  if (new Set(winnerIds).size < 2) return;

  const [teamAId, teamBId] = winnerIds;
  const nextMatch = await prisma.match.create({
    data: {
      seasonId: match.seasonId,
      round: roundIndex + 2,
      teamAId,
      teamBId,
      matchType: "tournament"
    }
  });

  if (!state.roundMatchIds[roundIndex + 1]) state.roundMatchIds[roundIndex + 1] = [];
  state.roundMatchIds[roundIndex + 1].push(nextMatch.id);

  if (HAS_THIRD_PLACE[format as 4 | 8] && currentRoundIds.length === 2) {
    const loserIds = sourceMatches.map(
      (m) => (m.winnerId === m.teamAId ? m.teamBId! : m.teamAId!)
    );
    if (new Set(loserIds).size === 2) {
      const thirdPlaceMatch = await prisma.match.create({
        data: {
          seasonId: match.seasonId,
          round: roundIndex + 2,
          teamAId: loserIds[0],
          teamBId: loserIds[1],
          matchType: "tournament"
        }
      });
      state.roundMatchIds[roundIndex + 1].push(thirdPlaceMatch.id);
    }
  }

  await prisma.season.update({
    where: { id: match.seasonId },
    data: { bracketState: state as unknown as object }
  });
}
