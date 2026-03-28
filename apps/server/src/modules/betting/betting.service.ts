import { Prisma } from "@prisma/client";
import { prisma } from "../../db/index.js";
import { BusinessError, BusinessErrorCode } from "../../shared/errors.js";
import { expectedScore } from "../ranking/rating.service.js";

const MIN_BET = 100;
const MAX_BET = 10_000;

export async function placeBet(userId: string, matchId: string, teamId: string, amount: number) {
  if (amount < MIN_BET || amount > MAX_BET) {
    throw new BusinessError(BusinessErrorCode.BET_AMOUNT_OUT_OF_RANGE);
  }

  const [match, user] = await Promise.all([
    prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true, teamAId: true, teamBId: true }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })
  ]);

  if (!match) throw new Error("Match not found");
  if (!user) throw new Error("User not found");
  if (match.status !== "scheduled") {
    throw new BusinessError(BusinessErrorCode.BET_MATCH_NOT_PENDING);
  }
  if (teamId !== match.teamAId && teamId !== match.teamBId) {
    throw new BusinessError(BusinessErrorCode.BET_INVALID_TEAM);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const debit = await tx.user.updateMany({
        where: { id: userId, walletBalance: { gte: amount } },
        data: { walletBalance: { decrement: amount } }
      });
      if (debit.count === 0) {
        throw new BusinessError(BusinessErrorCode.INSUFFICIENT_BALANCE);
      }
      return tx.bet.create({
        data: {
          userId,
          matchId,
          teamId,
          amount,
          status: "pending"
        }
      });
    });
  } catch (err) {
    if (err instanceof BusinessError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new BusinessError(BusinessErrorCode.BET_ALREADY_PLACED);
    }
    throw err;
  }
}

export async function getUserBets(userId: string) {
  return prisma.bet.findMany({
    where: { userId },
    include: {
      match: {
        include: {
          teamA: true,
          teamB: true,
          winner: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export type MatchOddsSide = {
  teamId: string;
  teamName: string;
  impliedProbability: number;
  odds: number;
};

export async function getMatchOdds(matchId: string): Promise<{ teamA: MatchOddsSide; teamB: MatchOddsSide }> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, name: true, rating: true } },
      teamB: { select: { id: true, name: true, rating: true } }
    }
  });
  if (!match) throw new Error("Match not found");

  const pA = expectedScore(match.teamA.rating, match.teamB.rating);
  const pB = 1 - pA;
  const oddsA = Math.round((1 / pA) * 100) / 100;
  const oddsB = Math.round((1 / pB) * 100) / 100;

  return {
    teamA: {
      teamId: match.teamA.id,
      teamName: match.teamA.name,
      impliedProbability: pA,
      odds: oddsA
    },
    teamB: {
      teamId: match.teamB.id,
      teamName: match.teamB.name,
      impliedProbability: pB,
      odds: oddsB
    }
  };
}

async function settleBetsInTransaction(tx: Prisma.TransactionClient, matchId: string, winnerId: string | null) {
  const pending = await tx.bet.findMany({
    where: { matchId, status: "pending" }
  });
  if (pending.length === 0) return;

  if (winnerId == null) {
    for (const b of pending) {
      await tx.user.update({
        where: { id: b.userId },
        data: { walletBalance: { increment: b.amount } }
      });
      await tx.bet.update({
        where: { id: b.id },
        data: { status: "cancelled", payout: b.amount }
      });
    }
    return;
  }

  const winners = pending.filter((b) => b.teamId === winnerId);
  const losers = pending.filter((b) => b.teamId !== winnerId);
  const totalPool = pending.reduce((s, b) => s + b.amount, 0);
  const winnerPool = winners.reduce((s, b) => s + b.amount, 0);

  for (const b of losers) {
    await tx.bet.update({
      where: { id: b.id },
      data: { status: "lost", payout: 0 }
    });
  }

  if (winnerPool === 0) return;

  for (const b of winners) {
    const payout = Math.floor((b.amount / winnerPool) * totalPool);
    await tx.bet.update({
      where: { id: b.id },
      data: { status: "won", payout }
    });
    await tx.user.update({
      where: { id: b.userId },
      data: { walletBalance: { increment: payout } }
    });
  }
}

/** Pass `tx` to run inside an existing transaction (e.g. match finalization). */
export async function settleBets(matchId: string, winnerId: string | null, tx?: Prisma.TransactionClient) {
  if (tx) {
    return settleBetsInTransaction(tx, matchId, winnerId);
  }
  return prisma.$transaction((inner) => settleBetsInTransaction(inner, matchId, winnerId));
}
