import { prisma } from "../../db/index.js";
import { applyRatingFromMatch, getPositionsForTeams, getRankingPreview } from "../ranking/rating.service.js";

const SYSTEM_USER_EMAIL = "system@csm.league";
const POINTS_PER_WIN = 3;

/** Premiação por vitória em partida */
const MATCH_WIN_PRIZE = 500;

/** Premiação do campeonato ao fim da temporada (1º, 2º, 3º) */
const LEAGUE_CHAMPIONSHIP_PRIZES = [2000, 1000, 500] as const;

/** Round-robin para 4 times: 6 partidas (cada par joga uma vez) */
function scheduleRoundRobin(teamIds: [string, string, string, string]): Array<{ round: number; teamAId: string; teamBId: string }> {
  const [a, b, c, d] = teamIds;
  return [
    { round: 1, teamAId: a, teamBId: b },
    { round: 2, teamAId: a, teamBId: c },
    { round: 3, teamAId: a, teamBId: d },
    { round: 4, teamAId: b, teamBId: c },
    { round: 5, teamAId: b, teamBId: d },
    { round: 6, teamAId: c, teamBId: d }
  ];
}

export async function getOrCreateActiveSeason(userId: string) {
  let season = await prisma.season.findFirst({
    where: { userId, status: "active" },
    include: { matches: { include: { teamA: true, teamB: true, winner: true } } }
  });

  if (season) return season;

  const systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
  if (!systemUser) throw new Error("System user not found. Run db:seed.");

  const npcTeams = await prisma.team.findMany({
    where: { userId: systemUser.id },
    include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } }
  });
  if (npcTeams.length < 3) throw new Error("NPC teams not found. Run db:seed.");

  const userTeams = await prisma.team.findMany({
    where: { userId },
    include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } }
  });
  const userTeam = userTeams[0];
  if (!userTeam || userTeam.players.length < 5) {
    throw new Error("User must have a team with at least 5 starters.");
  }

  const leagueTeams = [userTeam, npcTeams[0], npcTeams[1], npcTeams[2]];
  const teamIds = leagueTeams.map((t) => t.id) as [string, string, string, string];

  const newSeason = await prisma.season.create({
    data: {
      userId,
      name: "Temporada 1",
      status: "active"
    }
  });

  const fixtures = scheduleRoundRobin(teamIds);
  for (const f of fixtures) {
    await prisma.match.create({
      data: {
        seasonId: newSeason.id,
        round: f.round,
        teamAId: f.teamAId,
        teamBId: f.teamBId
      }
    });
  }

  return prisma.season.findUnique({
    where: { id: newSeason.id },
    include: { matches: { include: { teamA: true, teamB: true, winner: true } } }
  })!;
}

export async function getMatches(seasonId: string, status?: "scheduled" | "finished") {
  const where: { seasonId: string; status?: string } = { seasonId };
  if (status) where.status = status;
  return prisma.match.findMany({
    where,
    include: {
      teamA: { include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } } },
      teamB: { include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } } },
      winner: true,
      playerStats: { include: { player: true } }
    },
    orderBy: { round: "asc" }
  });
}

export async function getMatchById(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      season: true,
      teamA: { include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } } },
      teamB: { include: { players: { where: { isStarter: true }, orderBy: { sortOrder: "asc" } } } },
      winner: true,
      playerStats: { include: { player: true } }
    }
  });
  if (!match) throw new Error("Match not found");
  return match;
}

export type PersistMatchBody = {
  winnerId: string | null;
  scoreA: number;
  scoreB: number;
  playerStats?: Array<{ playerId: string; kills: number; deaths: number; assists: number }>;
};

export async function persistMatchResult(matchId: string, body: PersistMatchBody) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { season: true }
  });
  if (!match) throw new Error("Match not found");
  if (match.status === "finished") throw new Error("Match already finished");

  const { winnerId, scoreA, scoreB, playerStats } = body;
  const isDraw = winnerId === null || winnerId === undefined;
  if (!isDraw && winnerId !== match.teamAId && winnerId !== match.teamBId) {
    throw new Error("winnerId must be teamA or teamB");
  }

  const loserId = !isDraw && winnerId ? (winnerId === match.teamAId ? match.teamBId : match.teamAId) : null;
  const seasonId = match.seasonId;

  const winnerTeam = winnerId
    ? await prisma.team.findUnique({ where: { id: winnerId }, select: { userId: true } })
    : null;
  const finishedCount = await prisma.match.count({ where: { seasonId, status: "finished" } });
  const championshipFormat = match.season.championshipFormat as number | null;
  const championshipMatchTotals: Record<number, number> = { 2: 1, 4: 3, 8: 7 };
  const isChampionshipFinal = championshipFormat && finishedCount + 1 === championshipMatchTotals[championshipFormat];
  const isLastMatchOfSeason = isChampionshipFinal || (!championshipFormat && finishedCount === 5);

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        winnerId: winnerId ?? null,
        scoreA,
        scoreB,
        status: "finished"
      }
    });
    if (winnerId && loserId) {
      await tx.team.update({
        where: { id: winnerId },
        data: { wins: { increment: 1 } }
      });
      await tx.team.update({
        where: { id: loserId },
        data: { losses: { increment: 1 } }
      });
    }

    if (winnerTeam?.userId) {
      const systemUser = await tx.user.findUnique({
        where: { email: SYSTEM_USER_EMAIL },
        select: { id: true }
      });
      if (winnerTeam.userId !== systemUser?.id) {
        await tx.user.update({
          where: { id: winnerTeam.userId },
          data: { walletBalance: { increment: MATCH_WIN_PRIZE } }
        });
      }
    }

    if (isLastMatchOfSeason) {
      let teamRanking: { teamId: string }[];
      if (isChampionshipFinal && winnerId && loserId) {
        teamRanking = [{ teamId: winnerId }, { teamId: loserId }];
      } else {
        const finishedMatches = await tx.match.findMany({
          where: { seasonId, status: "finished" },
          select: { winnerId: true }
        });
        const teamIds = new Set<string>();
        const allMatches = await tx.match.findMany({ where: { seasonId } });
        for (const m of allMatches) {
          teamIds.add(m.teamAId);
          teamIds.add(m.teamBId);
        }
        const wins = new Map<string, number>();
        for (const tid of teamIds) wins.set(tid, 0);
        for (const m of finishedMatches) {
          if (m.winnerId) wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1);
        }
        const teams = await tx.team.findMany({ where: { id: { in: Array.from(teamIds) } } });
        teamRanking = teams
          .map((t) => ({ teamId: t.id, points: (wins.get(t.id) ?? 0) * POINTS_PER_WIN }))
          .sort((a, b) => (b as { points: number }).points - (a as { points: number }).points);
      }

      await tx.season.update({
        where: { id: seasonId },
        data: { status: "finished" }
      });
      const systemUser = await tx.user.findUnique({
        where: { email: SYSTEM_USER_EMAIL },
        select: { id: true }
      });
      const prizes = isChampionshipFinal && championshipFormat
        ? (await import("../championship/championship.service.js")).CHAMPIONSHIP_TEMPLATES.find(
            (t) => t.format === championshipFormat
          )?.prizes ?? LEAGUE_CHAMPIONSHIP_PRIZES
        : LEAGUE_CHAMPIONSHIP_PRIZES;
      for (let i = 0; i < Math.min(prizes.length, teamRanking.length); i++) {
        const t = await tx.team.findUnique({
          where: { id: teamRanking[i].teamId },
          select: { userId: true }
        });
        if (t?.userId && t.userId !== systemUser?.id && prizes[i]) {
          await tx.user.update({
            where: { id: t.userId },
            data: { walletBalance: { increment: prizes[i] } }
          });
        }
      }
    }
  });

  if (playerStats && playerStats.length > 0) {
    await prisma.matchPlayerStat.createMany({
      data: playerStats.map((s) => ({
        matchId,
        playerId: s.playerId,
        kills: s.kills,
        deaths: s.deaths,
        assists: s.assists
      })),
      skipDuplicates: true
    });
  }

  const matchType = (match as { matchType?: string }).matchType ?? "tournament";
  const positionsBefore = await getPositionsForTeams([match.teamAId, match.teamBId]);
  const ratingResult = await applyRatingFromMatch(
    matchId,
    match.teamAId,
    match.teamBId,
    winnerId ?? null,
    matchType
  );
  const positionsAfter = await getPositionsForTeams([match.teamAId, match.teamBId]);
  const posA = positionsAfter.get(match.teamAId);
  const posB = positionsAfter.get(match.teamBId);
  const posBeforeA = positionsBefore.get(match.teamAId);
  const posBeforeB = positionsBefore.get(match.teamBId);
  const teamPositions = ratingResult && posA != null && posB != null
    ? {
        teamA: { position: posA, positionChange: posBeforeA != null ? posBeforeA - posA : 0 },
        teamB: { position: posB, positionChange: posBeforeB != null ? posBeforeB - posB : 0 }
      }
    : null;

  if (match.season.championshipFormat) {
    const { advanceChampionshipBracket } = await import("../championship/championship.service.js");
    await advanceChampionshipBracket(matchId);
  }

  const updatedMatch = await getMatchById(matchId);
  const rankingPreview = await getRankingPreview();

  return {
    match: updatedMatch,
    ratingResult,
    rankingPreview,
    teamPositions
  };
}

export async function getRanking(seasonId: string) {
  const finishedMatches = await prisma.match.findMany({
    where: { seasonId, status: "finished" },
    select: { winnerId: true, teamAId: true, teamBId: true }
  });

  const teamIds = new Set<string>();
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { matches: true }
  });
  if (!season) throw new Error("Season not found");

  for (const m of season.matches) {
    teamIds.add(m.teamAId);
    teamIds.add(m.teamBId);
  }

  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  for (const tid of teamIds) {
    wins.set(tid, 0);
    losses.set(tid, 0);
  }
  for (const m of finishedMatches) {
    if (m.winnerId) {
      wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1);
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      losses.set(loserId, (losses.get(loserId) ?? 0) + 1);
    }
  }

  const teams = await prisma.team.findMany({
    where: { id: { in: Array.from(teamIds) } }
  });

  return teams
    .map((t) => {
      const w = wins.get(t.id) ?? 0;
      const l = losses.get(t.id) ?? 0;
      return {
        teamId: t.id,
        teamName: t.name,
        points: w * POINTS_PER_WIN,
        wins: w,
        losses: l
      };
    })
    .sort((a, b) => b.points - a.points);
}

export type PlayerRankingItem = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
};

export async function getPlayerRanking(seasonId: string): Promise<PlayerRankingItem[]> {
  const matches = await prisma.match.findMany({
    where: { seasonId, status: "finished" },
    include: {
      playerStats: { include: { player: { include: { team: true } } } }
    }
  });

  const agg = new Map<
    string,
    { player: { id: string; name: string; role: string; team: { id: string; name: string } }; k: number; d: number; a: number }
  >();

  for (const m of matches) {
    for (const s of m.playerStats) {
      const p = s.player;
      const cur = agg.get(p.id);
      if (!cur) {
        agg.set(p.id, {
          player: p,
          k: s.kills,
          d: s.deaths,
          a: s.assists
        });
      } else {
        cur.k += s.kills;
        cur.d += s.deaths;
        cur.a += s.assists;
      }
    }
  }

  return Array.from(agg.values())
    .map(({ player, k, d, a }) => ({
      playerId: player.id,
      playerName: player.name,
      teamId: player.team.id,
      teamName: player.team.name,
      role: player.role,
      kills: k,
      deaths: d,
      assists: a
    }))
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}
