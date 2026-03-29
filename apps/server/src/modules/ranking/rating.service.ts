/**
 * Elo rating system for teams.
 * Formula: newRating = rating + K * (actual - expected)
 * actual: 1 win, 0.5 draw, 0 loss
 */
import { prisma } from "../../db/index.js";
import { decodeRankingCursor, encodeRankingCursor } from "./ranking.cursor.js";

const RANKING_CACHE_TTL_MS = 30_000;

type GlobalRankingCacheEntry = { expires: number; value: GlobalRankingResult };

const globalRankingCache = new Map<string, GlobalRankingCacheEntry>();

type RankingPreviewRow = { position: number; teamId: string; teamName: string; rating: number };

const previewCache = new Map<string, { expires: number; value: RankingPreviewRow[] }>();

function takeCachedGlobal(key: string): GlobalRankingResult | undefined {
  const e = globalRankingCache.get(key);
  if (!e || Date.now() > e.expires) {
    if (e) globalRankingCache.delete(key);
    return undefined;
  }
  return e.value;
}

function putCachedGlobal(key: string, value: GlobalRankingResult): void {
  globalRankingCache.set(key, { expires: Date.now() + RANKING_CACHE_TTL_MS, value });
}

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

export type GlobalRankingResult = {
  items: GlobalRankingItem[];
  total: number;
  /** Opaque cursor for the next page (`GET ...?cursor=`), or null when there are no more rows. */
  nextCursor: string | null;
};

export type GetGlobalRankingParams = {
  limit?: number;
  /** @deprecated Prefer `cursor`. When greater than zero, uses `skip`/`take` (not cached). */
  offset?: number;
  cursor?: string | null;
  /** When true, bypasses cache (e.g. after a rating change). */
  skipCache?: boolean;
};

const rankingOrderBy = [{ rating: "desc" as const }, { id: "asc" as const }];
const teamRankingSelect = { id: true, name: true, rating: true, matchesPlayed: true } as const;

/** Global ranking ordered by rating (descending), then `id` (ascending) for a stable order. */
export async function getGlobalRanking(params: GetGlobalRankingParams = {}): Promise<GlobalRankingResult> {
  const limit = Math.min(100, Math.max(1, params.limit ?? 100));
  const skipCache = params.skipCache ?? false;
  const offset = Math.max(0, params.offset ?? 0);
  const useLegacyOffset = offset > 0;
  const cursorRaw = params.cursor?.trim() || null;
  const cursorDecoded = cursorRaw ? decodeRankingCursor(cursorRaw) : null;

  if (cursorRaw && !cursorDecoded) {
    throw new Error("Invalid ranking cursor");
  }

  const cacheKeyHead = `g:${limit}:head`;
  const cacheKeyCursor = cursorRaw ? `g:${limit}:c:${cursorRaw}` : null;

  if (!skipCache && !useLegacyOffset && !cursorRaw) {
    const hit = takeCachedGlobal(cacheKeyHead);
    if (hit) return hit;
  }
  if (!skipCache && cacheKeyCursor && cursorDecoded) {
    const hit = takeCachedGlobal(cacheKeyCursor);
    if (hit) return hit;
  }

  const total = await prisma.team.count();

  let teams: Array<{ id: string; name: string; rating: number; matchesPlayed: number }>;
  let firstPosition: number;

  if (cursorDecoded && !useLegacyOffset) {
    const cr = cursorDecoded.rating;
    const cid = cursorDecoded.id;
    const countBefore = await prisma.team.count({
      where: {
        OR: [{ rating: { gt: cr } }, { AND: [{ rating: cr }, { id: { lt: cid } }] }]
      }
    });
    firstPosition = countBefore + 1;
    teams = await prisma.team.findMany({
      where: {
        OR: [{ rating: { lt: cr } }, { AND: [{ rating: cr }, { id: { gt: cid } }] }]
      },
      orderBy: rankingOrderBy,
      take: limit,
      select: teamRankingSelect
    });
  } else if (useLegacyOffset) {
    teams = await prisma.team.findMany({
      orderBy: rankingOrderBy,
      skip: offset,
      take: limit,
      select: teamRankingSelect
    });
    firstPosition = offset + 1;
  } else {
    teams = await prisma.team.findMany({
      orderBy: rankingOrderBy,
      take: limit,
      select: teamRankingSelect
    });
    firstPosition = 1;
  }

  const items: GlobalRankingItem[] = teams.map((t, i) => ({
    position: firstPosition + i,
    teamId: t.id,
    teamName: t.name,
    rating: t.rating,
    tier: getTier(t.rating),
    matchesPlayed: t.matchesPlayed
  }));

  const last = teams[teams.length - 1];
  const nextCursor =
    teams.length === limit && last ? encodeRankingCursor({ rating: last.rating, id: last.id }) : null;

  const result: GlobalRankingResult = { items, total, nextCursor };

  if (!skipCache && !useLegacyOffset && !cursorRaw) {
    putCachedGlobal(cacheKeyHead, result);
  }
  if (!skipCache && cacheKeyCursor && cursorDecoded) {
    putCachedGlobal(cacheKeyCursor, result);
  }

  return result;
}

/** Top N for match end overlay. */
export async function getRankingPreview(
  topN = 5,
  opts?: { skipCache?: boolean }
): Promise<RankingPreviewRow[]> {
  const skipCache = opts?.skipCache ?? false;
  const key = `p:${topN}`;
  if (!skipCache) {
    const e = previewCache.get(key);
    if (e && Date.now() <= e.expires) return e.value;
    if (e) previewCache.delete(key);
  }
  const { items } = await getGlobalRanking({ limit: topN, skipCache: true });
  const preview = items.map(({ position, teamId, teamName, rating }) => ({ position, teamId, teamName, rating }));
  if (!skipCache) {
    previewCache.set(key, { expires: Date.now() + RANKING_CACHE_TTL_MS, value: preview });
  }
  return preview;
}

/** Retorna posição atual de cada time no ranking global (amostra até 200 primeiros). */
export async function getPositionsForTeams(teamIds: string[]): Promise<Map<string, number>> {
  if (teamIds.length === 0) return new Map();
  const { items } = await getGlobalRanking({ limit: 200, skipCache: true });
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
