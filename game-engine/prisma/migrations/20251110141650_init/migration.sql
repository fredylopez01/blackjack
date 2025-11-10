-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "HandResult" AS ENUM ('WIN', 'LOSE', 'PUSH', 'BLACKJACK');

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "GameStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "minBet" INTEGER NOT NULL,
    "maxBet" INTEGER NOT NULL,
    "deckCount" INTEGER NOT NULL DEFAULT 6,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSession" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "initialBalance" INTEGER NOT NULL,
    "currentBalance" INTEGER NOT NULL,
    "totalBet" INTEGER NOT NULL DEFAULT 0,
    "totalWon" INTEGER NOT NULL DEFAULT 0,
    "roundsPlayed" INTEGER NOT NULL DEFAULT 0,
    "roundsWon" INTEGER NOT NULL DEFAULT 0,
    "roundsLost" INTEGER NOT NULL DEFAULT 0,
    "roundsPush" INTEGER NOT NULL DEFAULT 0,
    "blackjacks" INTEGER NOT NULL DEFAULT 0,
    "busts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "dealerHand" JSONB NOT NULL,
    "dealerResult" TEXT,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hand" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "cards" JSONB NOT NULL,
    "bet" INTEGER NOT NULL,
    "result" "HandResult",
    "payout" INTEGER NOT NULL DEFAULT 0,
    "isBlackjack" BOOLEAN NOT NULL DEFAULT false,
    "isBusted" BOOLEAN NOT NULL DEFAULT false,
    "isDoubled" BOOLEAN NOT NULL DEFAULT false,
    "isSplit" BOOLEAN NOT NULL DEFAULT false,
    "isStanding" BOOLEAN NOT NULL DEFAULT false,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameSession_roomId_idx" ON "GameSession"("roomId");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");

-- CreateIndex
CREATE INDEX "GameSession_startedAt_idx" ON "GameSession"("startedAt");

-- CreateIndex
CREATE INDEX "PlayerSession_gameId_idx" ON "PlayerSession"("gameId");

-- CreateIndex
CREATE INDEX "PlayerSession_userId_idx" ON "PlayerSession"("userId");

-- CreateIndex
CREATE INDEX "Round_gameId_idx" ON "Round"("gameId");

-- CreateIndex
CREATE INDEX "Round_roundNumber_idx" ON "Round"("roundNumber");

-- CreateIndex
CREATE INDEX "Hand_roundId_idx" ON "Hand"("roundId");

-- CreateIndex
CREATE INDEX "Hand_playerId_idx" ON "Hand"("playerId");

-- AddForeignKey
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hand" ADD CONSTRAINT "Hand_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hand" ADD CONSTRAINT "Hand_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "PlayerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
