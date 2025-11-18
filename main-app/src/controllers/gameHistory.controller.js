import { prisma } from "../index.js";
import { logger } from "../utils/logger.js";
import { isDatabaseHealthy } from "../middleware/healthCheck.middleware.js";
import { publishPendingWrite } from "../services/rabbitmq.service.js";
import axios from "axios";

const GAME_ENGINE_URL = process.env.GAME_ENGINE_URL;

/**
 * Obtener historial de partidas del usuario - CON FALLBACK
 */
export async function getMyHistory(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limit = parseInt(req.query.limit) || 20;

    // Intentar desde base de datos principal
    if (isDatabaseHealthy()) {
      try {
        const history = await prisma.$queryRaw`
          SELECT * FROM "GameHistory"
          WHERE EXISTS (
            SELECT 1 FROM jsonb_array_elements(results) AS elem
            WHERE elem->>'userId' = ${userId}
          )
          ORDER BY "finishedAt" DESC
          LIMIT ${limit}
        `;

        const formattedHistory = history.map((game) => ({
          ...game,
          results:
            typeof game.results === "string"
              ? JSON.parse(game.results)
              : game.results,
        }));

        return res.json({
          message: "User history retrieved successfully",
          data: { history: formattedHistory },
          source: "database",
          mode: "normal",
        });
      } catch (error) {
        logger.warn(
          "Database query failed, falling back to game-engine:",
          error
        );
      }
    }

    // FALLBACK: Obtener desde game-engine
    try {
      const response = await axios.get(
        `${GAME_ENGINE_URL}/internal/history/user/${userId}?limit=${limit}`
      );

      return res.json({
        message: "User history retrieved from backup source",
        data: { history: response.data.history },
        source: "game-engine",
        mode: "degraded",
        warning: "Historical data from game engine. May be incomplete.",
      });
    } catch (fallbackError) {
      logger.error("Failed to get history from game-engine:", fallbackError);

      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "Cannot retrieve history data",
      });
    }
  } catch (error) {
    logger.error("Error retrieving user history:", error);
    res.status(500).json({
      error: "Failed to retrieve user history",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Obtener historial de una sala
 */
export async function getRoomHistory(req, res) {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ error: "Missing roomId parameter" });
    }

    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
        mode: "degraded",
      });
    }

    const history = await prisma.gameHistory.findMany({
      where: { roomId },
      orderBy: { finishedAt: "desc" },
      take: 50,
    });

    res.json({
      message: "Room history retrieved successfully",
      data: { history },
      source: "database",
      mode: "normal",
    });
  } catch (error) {
    logger.error("Error retrieving room history:", error);
    res.status(500).json({
      error: "Failed to retrieve room history",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Guardar historial de partida - CON ENCOLADO
 */
export async function saveGameHistory(req, res) {
  try {
    const {
      roomId,
      gameEngineId,
      startedAt,
      finishedAt,
      totalRounds,
      results,
    } = req.body;

    if (!roomId || !gameEngineId || !results || !Array.isArray(results)) {
      return res.status(400).json({
        error: "Missing required fields: roomId, gameEngineId, results",
      });
    }

    const historyData = {
      roomId,
      gameEngineId,
      startedAt: new Date(startedAt),
      finishedAt: finishedAt ? new Date(finishedAt) : null,
      totalRounds,
      playersCount: results.length,
      results: results.map((r) => ({
        userId: r.userId,
        username: r.username,
        profit: r.balance - r.initialBalance,
        roundsWon: r.roundsWon || 0,
        roundsLost: r.roundsLost || 0,
        roundsPush: r.roundsPush || 0,
        finalBalance: r.balance,
      })),
    };

    if (!isDatabaseHealthy()) {
      // Encolar para cuando BD se recupere
      await publishPendingWrite("SAVE_GAME_HISTORY", historyData);

      logger.warn(`Game history queued for ${gameEngineId}`);

      return res.status(202).json({
        message: "Game history queued for saving",
        mode: "degraded",
      });
    }

    try {
      const gameHistory = await prisma.gameHistory.create({
        data: historyData,
      });

      logger.info(
        `Game history saved: ${gameEngineId} with ${historyData.playersCount} players`
      );

      res.status(201).json({
        message: "Game history saved successfully",
        data: { gameHistory },
        mode: "normal",
      });
    } catch (dbError) {
      // Si falla incluso con health check OK, encolar
      await publishPendingWrite("SAVE_GAME_HISTORY", historyData);

      logger.warn(`Game history queued after DB error for ${gameEngineId}`);

      return res.status(202).json({
        message: "Game history queued for saving",
        mode: "degraded",
      });
    }
  } catch (error) {
    logger.error("Error saving game history:", error);
    res.status(500).json({
      error: "Failed to save game history",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Actualizar rankings - CON ENCOLADO
 */
export async function updatePlayerRankings(req, res) {
  try {
    const { results } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({
        error: "Missing required fields: results (array)",
      });
    }

    if (!isDatabaseHealthy()) {
      // Encolar actualización de rankings
      await publishPendingWrite("UPDATE_RANKINGS", { results });

      logger.warn(`Rankings update queued for ${results.length} players`);

      return res.status(202).json({
        message: "Rankings update queued",
        mode: "degraded",
      });
    }

    try {
      const updatedPlayers = [];

      for (const result of results) {
        const { userId, username, profit, roundsWon, roundsLost } = result;

        let ranking = await prisma.playerRanking.findUnique({
          where: { userId },
        });

        if (!ranking) {
          ranking = await prisma.playerRanking.create({
            data: {
              userId,
              username,
              totalGames: 1,
              gamesWon: roundsWon > roundsLost ? 1 : 0,
              gamesLost: roundsLost > roundsWon ? 1 : 0,
              totalProfit: profit,
              winRate: roundsWon > roundsLost ? 100 : 0,
              lastPlayed: new Date(),
            },
          });
        } else {
          const newTotalGames = ranking.totalGames + 1;
          const newGamesWon =
            ranking.gamesWon + (roundsWon > roundsLost ? 1 : 0);
          const newGamesLost =
            ranking.gamesLost + (roundsLost > roundsWon ? 1 : 0);
          const newTotalProfit = ranking.totalProfit + profit;
          const newWinRate =
            newTotalGames > 0 ? (newGamesWon / newTotalGames) * 100 : 0;

          ranking = await prisma.playerRanking.update({
            where: { userId },
            data: {
              totalGames: newTotalGames,
              gamesWon: newGamesWon,
              gamesLost: newGamesLost,
              totalProfit: newTotalProfit,
              winRate: newWinRate,
              lastPlayed: new Date(),
            },
          });
        }

        updatedPlayers.push({
          userId,
          username,
          totalGames: ranking.totalGames,
          totalProfit: ranking.totalProfit,
          winRate: Math.round(ranking.winRate),
        });
      }

      await updateAllRanks();

      logger.info(`Rankings updated for ${updatedPlayers.length} players`);

      res.json({
        message: "Rankings updated successfully",
        data: { updatedPlayers },
        mode: "normal",
      });
    } catch (dbError) {
      // Si falla, encolar
      await publishPendingWrite("UPDATE_RANKINGS", { results });

      logger.warn(`Rankings update queued after DB error`);

      return res.status(202).json({
        message: "Rankings update queued",
        mode: "degraded",
      });
    }
  } catch (error) {
    logger.error("Error updating rankings:", error);
    res.status(500).json({
      error: "Failed to update rankings",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function updateAllRanks() {
  try {
    const allRankings = await prisma.playerRanking.findMany({
      orderBy: [{ totalProfit: "desc" }, { winRate: "desc" }],
    });

    for (let i = 0; i < allRankings.length; i++) {
      await prisma.playerRanking.update({
        where: { userId: allRankings[i].userId },
        data: { rank: i + 1 },
      });
    }

    logger.info(`All player ranks updated (${allRankings.length} players)`);
  } catch (error) {
    logger.error("Error updating all ranks:", error);
    throw error;
  }
}
