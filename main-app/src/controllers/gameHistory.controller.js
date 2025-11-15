import { prisma } from "../index.js";
import { logger } from "../utils/logger.js";
import { isDatabaseHealthy } from "../middleware/healthCheck.middleware.js";

/**
 * Obtener historial de partidas del usuario autenticado
 */
export async function getMyHistory(req, res) {
  try {
    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const history = await prisma.$queryRaw`
      SELECT * FROM "GameHistory"
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(results) AS elem
        WHERE elem->>'userId' = ${userId}
      )
      ORDER BY "finishedAt" DESC
      LIMIT 50
    `;

    // Mapear y asegurar que results sea un objeto JavaScript válido
    const formattedHistory = history.map((game) => ({
      ...game,
      results:
        typeof game.results === "string"
          ? JSON.parse(game.results)
          : game.results,
    }));

    res.json({
      message: "User history retrieved successfully",
      data: { history: formattedHistory },
    });
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
 * Obtener historial de partidas de una sala específica
 */
export async function getRoomHistory(req, res) {
  try {
    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ error: "Missing roomId parameter" });
    }

    const history = await prisma.gameHistory.findMany({
      where: { roomId },
      orderBy: { finishedAt: "desc" },
      take: 50,
    });

    res.json({
      message: "Room history retrieved successfully",
      data: { history },
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
 * Guardar historial de una partida completada
 * Llamado por game-engine al finalizar una partida
 */
export async function saveGameHistory(req, res) {
  try {
    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    const {
      roomId,
      gameEngineId,
      startedAt,
      finishedAt,
      totalRounds,
      results,
    } = req.body;

    // Validar datos requeridos
    if (!roomId || !gameEngineId || !results || !Array.isArray(results)) {
      return res.status(400).json({
        error: "Missing required fields: roomId, gameEngineId, results",
      });
    }

    // Calcular estadísticas
    const playersCount = results.length;
    const resultsWithStats = results.map((r) => ({
      userId: r.userId,
      username: r.username,
      profit: r.balance - r.initialBalance,
      roundsWon: r.roundsWon || 0,
      roundsLost: r.roundsLost || 0,
      roundsPush: r.roundsPush || 0,
      finalBalance: r.balance,
    }));

    // Guardar historial
    const gameHistory = await prisma.gameHistory.create({
      data: {
        roomId,
        gameEngineId,
        startedAt: new Date(startedAt),
        finishedAt: finishedAt ? new Date(finishedAt) : null,
        totalRounds,
        playersCount,
        results: resultsWithStats,
      },
    });

    logger.info(
      `Game history saved: ${gameEngineId} with ${playersCount} players`
    );

    res.status(201).json({
      message: "Game history saved successfully",
      data: { gameHistory },
    });
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
 * Actualizar ranking de jugadores después de una partida
 * Llamado por game-engine al finalizar una partida
 */
export async function updatePlayerRankings(req, res) {
  try {
    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    const { results } = req.body; // Mismo formato que saveGameHistory

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({
        error: "Missing required fields: results (array)",
      });
    }

    const updatedPlayers = [];

    for (const result of results) {
      const { userId, username, profit, roundsWon, roundsLost } = result;

      // Obtener ranking actual o crear uno nuevo
      let ranking = await prisma.playerRanking.findUnique({
        where: { userId },
      });

      if (!ranking) {
        // Crear nuevo ranking
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
        // Actualizar ranking existente
        const newTotalGames = ranking.totalGames + 1;
        const newGamesWon = ranking.gamesWon + (roundsWon > roundsLost ? 1 : 0);
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

    // Actualizar rank (posición) para todos los jugadores
    await updateAllRanks();

    logger.info(`Rankings updated for ${updatedPlayers.length} players`);

    res.json({
      message: "Rankings updated successfully",
      data: { updatedPlayers },
    });
  } catch (error) {
    logger.error("Error updating rankings:", error);
    res.status(500).json({
      error: "Failed to update rankings",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Recalcular las posiciones (rank) de todos los jugadores
 */
async function updateAllRanks() {
  try {
    // Obtener todos los rankings ordenados por profit
    const allRankings = await prisma.playerRanking.findMany({
      orderBy: [{ totalProfit: "desc" }, { winRate: "desc" }],
    });

    // Actualizar rank para cada jugador
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
