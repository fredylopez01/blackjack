import { prisma } from "../index.js";
import { logger } from "../utils/logger.js";
import { isDatabaseHealthy } from "../middleware/healthCheck.middleware.js";

export async function getGlobalRanking(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;

    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    const rankings = await prisma.playerRanking.findMany({
      take: limit,
      orderBy: [{ totalProfit: "desc" }, { winRate: "desc" }],
    });

    res.json({
      rankings,
      total: rankings.length,
    });
  } catch (error) {
    logger.error("Error getting global ranking:", error);
    res.status(500).json({ error: "Failed to get ranking" });
  }
}

export async function getMyStats(req, res) {
  try {
    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    const stats = await prisma.playerRanking.findUnique({
      where: { userId: req.user.id },
    });

    if (!stats) {
      return res.status(404).json({
        error: "Estadisticas no encontradas para este usuario",
      });
    }

    res.json(stats);
  } catch (error) {
    logger.error("Error getting my stats:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
}
