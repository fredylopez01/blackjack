-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'PLAYING', 'FINISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WriteStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT,
    "maxPlayers" INTEGER NOT NULL DEFAULT 5,
    "minBet" INTEGER NOT NULL DEFAULT 10,
    "maxBet" INTEGER NOT NULL DEFAULT 1000,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "config" JSONB,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameHistory" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "gameEngineId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "playersCount" INTEGER NOT NULL,
    "results" JSONB NOT NULL,

    CONSTRAINT "GameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerRanking" (
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "gamesLost" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "lastPlayed" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerRanking_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PendingWrite" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "status" "WriteStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PendingWrite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE INDEX "Room_isPublic_idx" ON "Room"("isPublic");

-- CreateIndex
CREATE INDEX "Room_createdBy_idx" ON "Room"("createdBy");

-- CreateIndex
CREATE INDEX "GameHistory_roomId_idx" ON "GameHistory"("roomId");

-- CreateIndex
CREATE INDEX "GameHistory_startedAt_idx" ON "GameHistory"("startedAt");

-- CreateIndex
CREATE INDEX "PlayerRanking_totalProfit_idx" ON "PlayerRanking"("totalProfit");

-- CreateIndex
CREATE INDEX "PlayerRanking_winRate_idx" ON "PlayerRanking"("winRate");

-- CreateIndex
CREATE INDEX "PlayerRanking_rank_idx" ON "PlayerRanking"("rank");

-- CreateIndex
CREATE INDEX "PendingWrite_status_idx" ON "PendingWrite"("status");

-- CreateIndex
CREATE INDEX "PendingWrite_createdAt_idx" ON "PendingWrite"("createdAt");

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
