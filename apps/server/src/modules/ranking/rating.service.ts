/**
 * Elo rating system for teams.
 * Formula: newRating = rating + K * (actual - expected)
 * actual: 1 win, 0.5 draw, 0 loss
 */
import { prisma } from "../../db/index.js";

const INITIAL_RATING = 1500;
const K_TOURNAMENT_MULTIPLIER = 1.5;

/** Probability that team A beats team B: 1 / (1 + 10^((ratingB - ratingA) / 400)) */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Base K by matches played. MVP: omit Top 100 rule. */
export function getKBase(matchesPlayed: number): number {
  if (matchesPlayed < 20) return 48;
  if (matchesPlayed < 50) return 32;
  return 24;
}

/** Effective K for tournament: base * 1.5 */
export function getKFactor(matchesPlayed: number): number {
  return Math.round(getKBase(matchesPlayed) * K_TOURNAMENT_MULTIPLIER);
}

/** New rating after match: rating + K * (actual - expected) */
export function computeRatingUpdate(rating: number, expected: number, actual: number, k: number): number {
  const delta = k * (actual - expected);
  return Math.round(rating + delta);
}

/** Tier by rating */
export function getTier(rating: number): string {
  if (rating < 1000) return "Bronze";
  if (rating < 1500) return "Prata";
  if (rating < 2000) return "Ouro";
  if (rating < 2500) return "Platina";
  if (rating < 3000) return "Diamante";
  return "Lendário";
}

export type RatingResult = {
  teamA: { teamId: string; teamName: string; delta: number; newRating: number };
  teamB: { teamId: string; teamName: string; delta: number; newRating: number };
};

/** Apply Elo update from a finished match. Returns null for friendly (no rating change). */
export async function applyRatingFromMatch(
  matchId: string,
  teamAId: string,
  teamBId: string,
  winnerId: string | null,
  matchType: string
): Promise<RatingResult | null> {
  if (matchType === "friendly") return null;

  const [teamA, teamB] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamAId },
      select: { id: true, name: true, rating: true, matchesPlayed: true }
    }),
    prisma.team.findUnique({
      where: { id: teamBId },
      select: { id: true, name: true, rating: true, matchesPlayed: true }
    })
  ]);

  if (!teamA || !teamB) throw new Error("Team not found");

  const isDraw = winnerId === null;
  const actualA = isDraw ? 0.5 : winnerId === teamAId ? 1 : 0;
  const actualB = isDraw ? 0.5 : winnerId === teamBId ? 1 : 0;

  const expectedA = expectedScore(teamA.rating, teamB.rating);
  const expectedB = 1 - expectedA;

  const kA = getKFactor(teamA.matchesPlayed);
  const kB = getKFactor(teamB.matchesPlayed);

  const newRatingA = computeRatingUpdate(teamA.rating, expectedA, actualA, kA);
  const newRatingB = computeRatingUpdate(teamB.rating, expectedB, actualB, kB);

  const deltaA = newRatingA - teamA.rating;
  const deltaB = newRatingB - teamB.rating;

  const now = new Date();

  await prisma.$transaction([
    prisma.team.update({
      where: { id: teamAId },
      data: { rating: newRatingA, matchesPlayed: { increment: 1 }, lastMatchAt: now }
    }),
    prisma.team.update({
      where: { id: teamBId },
      data: { rating: newRatingB, matchesPlayed: { increment: 1 }, lastMatchAt: now }
    }),
    prisma.teamRatingHistory.create({
      data: {
        teamId: teamAId,
        matchId,
        ratingBefore: teamA.rating,
        ratingAfter: newRatingA,
        ratingDelta: deltaA,
        opponentId: teamBId,
        result: actualA,
        kFactor: kA
      }
    }),
    prisma.teamRatingHistory.create({
      data: {
        teamId: teamBId,
        matchId,
        ratingBefore: teamB.rating,
        ratingAfter: newRatingB,
        ratingDelta: deltaB,
        opponentId: teamAId,
        result: actualB,
        kFactor: kB
      }
    })
  ]);

  return {
    teamA: { teamId: teamAId, teamName: teamA.name, delta: deltaA, newRating: newRatingA },
    teamB: { teamId: teamBId, teamName: teamB.name, delta: deltaB, newRating: newRatingB }
  };
}

export type GlobalRankingItem = {
  position: number;
  teamId: string;
  teamName: string;
  rating: number;
  tier: string;
  matchesPlayed: number;
};

/** Global ranking ordered by rating (descending). */
export async function getGlobalRanking(limit = 100, offset = 0): Promise<{
  items: GlobalRankingItem[];
  total: number;
}> {
  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      orderBy: { rating: "desc" },
      skip: offset,
      take: limit,
      select: { id: true, name: true, rating: true, matchesPlayed: true }
    }),
    prisma.team.count()
  ]);

  const items = teams.map((t, i) => ({
    position: offset + i + 1,
    teamId: t.id,
    teamName: t.name,
    rating: t.rating,
    tier: getTier(t.rating),
    matchesPlayed: t.matchesPlayed
  }));

  return { items, total };
}

/** Top N for match end overlay. */
export async function getRankingPreview(topN = 5): Promise<Array<{ position: number; teamId: string; teamName: string; rating: number }>> {
  const { items } = await getGlobalRanking(topN, 0);
  return items.map(({ position, teamId, teamName, rating }) => ({ position, teamId, teamName, rating }));
}

/** Retorna posição atual de cada time no ranking global. */
export async function getPositionsForTeams(
  teamIds: string[]
): Promise<Map<string, number>> {
  if (teamIds.length === 0) return new Map();
  const { items } = await getGlobalRanking(200, 0);
  const map = new Map<string, number>();
  for (const item of items) {
    if (teamIds.includes(item.teamId)) map.set(item.teamId, item.position);
  }
  return map;
}

export type TeamRatingHistoryItem = {
  matchId: string;
  opponentName: string;
  result: "win" | "draw" | "loss";
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  createdAt: string;
};

/** Rating evolution history for a team. */
export async function getTeamRatingHistory(teamId: string): Promise<{
  teamId: string;
  teamName: string;
  currentRating: number;
  history: TeamRatingHistoryItem[];
}> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, rating: true }
  });
  if (!team) throw new Error("Team not found");

  const records = await prisma.teamRatingHistory.findMany({
    where: { teamId },
    include: {
      match: { include: { teamA: true, teamB: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const history: TeamRatingHistoryItem[] = records.map((r) => {
    const opponent = r.opponentId === r.match.teamAId ? r.match.teamA : r.match.teamB;
    const result: "win" | "draw" | "loss" =
      r.result === 1 ? "win" : r.result === 0.5 ? "draw" : "loss";
    return {
      matchId: r.matchId,
      opponentName: opponent.name,
      result,
      ratingBefore: r.ratingBefore,
      ratingAfter: r.ratingAfter,
      ratingDelta: r.ratingDelta,
      createdAt: r.createdAt.toISOString()
    };
  });

  return {
    teamId: team.id,
    teamName: team.name,
    currentRating: team.rating,
    history
  };
}
