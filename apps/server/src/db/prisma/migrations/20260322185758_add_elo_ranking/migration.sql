-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "matchType" TEXT NOT NULL DEFAULT 'tournament';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "lastMatchAt" TIMESTAMP(3),
ADD COLUMN     "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 1500;

-- CreateTable
CREATE TABLE "TeamRatingHistory" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "ratingBefore" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "ratingDelta" INTEGER NOT NULL,
    "opponentId" TEXT NOT NULL,
    "result" DOUBLE PRECISION NOT NULL,
    "kFactor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRatingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamRatingHistory_teamId_idx" ON "TeamRatingHistory"("teamId");

-- CreateIndex
CREATE INDEX "TeamRatingHistory_matchId_idx" ON "TeamRatingHistory"("matchId");

-- AddForeignKey
ALTER TABLE "TeamRatingHistory" ADD CONSTRAINT "TeamRatingHistory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRatingHistory" ADD CONSTRAINT "TeamRatingHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
