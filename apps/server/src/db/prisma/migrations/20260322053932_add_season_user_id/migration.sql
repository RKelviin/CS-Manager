-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Season_userId_idx" ON "Season"("userId");

-- CreateIndex
CREATE INDEX "Season_status_idx" ON "Season"("status");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
