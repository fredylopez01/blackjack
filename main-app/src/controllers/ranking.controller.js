import axios from "axios";
import { prisma } from "../index.js";
import { logger } from "../utils/logger.js";
import { isDatabaseHealthy } from "../middleware/healthCheck.middleware.js";

const GAME_ENGINE_URL = process.env.GAME_ENGINE_URL;

/**
 * Obtener ranking global - CON FALLBACK A GAME-ENGINE
 */
export async function getGlobalRanking(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;

    // Intentar obtener de main-app BD primero
    if (isDatabaseHealthy()) {
      try {
        const rankings = await prisma.playerRanking.findMany({
          take: limit,
          orderBy: [{ totalProfit: "desc" }, { winRate: "desc" }],
        });

        return res.json({
          rankings,
          total: rankings.length,
          source: "database",
          mode: "normal",
        });
      } catch (dbError) {
        logger.warn("Database query failed, trying fallback:", dbError.message);
      }
    }

    // FALLBACK: Obtener desde game-engine
    try {
      logger.info("Using game-engine fallback for global ranking");
      const response = await axios.get(
        `${GAME_ENGINE_URL}/internal/ranking/global?limit=${limit}`,
        { timeout: 5000 }
      );

      return res.json({
        rankings: response.data.rankings || [],
        total: response.data.rankings?.length || 0,
        source: "game-engine",
        mode: "degraded",
        warning:
          "Rankings computed from game-engine data. May not include all players.",
      });
    } catch (fallbackError) {
      logger.error(
        "Failed to get ranking from game-engine:",
        fallbackError.message
      );

      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "Cannot retrieve rankings at this time",
        mode: "error",
      });
    }
  } catch (error) {
    logger.error("Error getting global ranking:", error);
    res.status(500).json({
      error: "Failed to get ranking",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Obtener estadísticas del usuario - CON FALLBACK A GAME-ENGINE
 */
export async function getMyStats(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Intentar obtener de main-app BD primero
    if (isDatabaseHealthy()) {
      try {
        const stats = await prisma.playerRanking.findUnique({
          where: { userId },
        });

        if (stats) {
          return res.json({
            ...stats,
            source: "database",
            mode: "normal",
          });
        }
      } catch (dbError) {
        logger.warn("Database query failed, trying fallback:", dbError.message);
      }
    }

    // FALLBACK: Obtener desde game-engine
    try {
      logger.info(`Using game-engine fallback for stats of user ${userId}`);
      const response = await axios.get(
        `${GAME_ENGINE_URL}/internal/ranking/user/${userId}`,
        { timeout: 5000 }
      );

      return res.json({
        ...response.data,
        source: "game-engine",
        mode: "degraded",
        warning:
          "Statistics from game-engine. Rank unavailable in degraded mode.",
      });
    } catch (fallbackError) {
      logger.error(
        "Failed to get user stats from game-engine:",
        fallbackError.message
      );

      // Si no existe en ningún lado, retornar estructura vacía
      return res.status(404).json({
        error: "Statistics not found",
        message: "User has no game history yet",
        source: "none",
        mode: "error",
      });
    }
  } catch (error) {
    logger.error("Error getting my stats:", error);
    res.status(500).json({
      error: "Failed to get stats",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
