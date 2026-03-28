-- AlterTable
ALTER TABLE "Player" ADD COLUMN "templateId" TEXT;

-- CreateTable
CREATE TABLE "PlayerTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "aim" INTEGER NOT NULL,
    "reflex" INTEGER NOT NULL,
    "decision" INTEGER NOT NULL,
    "composure" INTEGER NOT NULL,
    "nationality" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTemplate_name_key" ON "PlayerTemplate"("name");
