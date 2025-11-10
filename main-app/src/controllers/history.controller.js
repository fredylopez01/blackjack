import { prisma } from "../index.js";
import { logger } from "../utils/logger.js";
import { isDatabaseHealthy } from "../middleware/healthCheck.middleware.js";

export async function getMyHistory(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;

    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    // Obtener historial donde el usuario participó
    const history = await prisma.gameHistory.findMany({
      where: {
        results: {
          path: "$[*].userId",
          array_contains: req.user.userId,
        },
      },
      take: limit,
      orderBy: {
        startedAt: "desc",
      },
      include: {
        room: {
          select: {
            name: true,
            minBet: true,
            maxBet: true,
          },
        },
      },
    });

    res.json({
      history,
      total: history.length,
    });
  } catch (error) {
    logger.error("Error getting my history:", error);
    res.status(500).json({ error: "Failed to get history" });
  }
}

export async function getRoomHistory(req, res) {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    const history = await prisma.gameHistory.findMany({
      where: { roomId },
      take: limit,
      orderBy: {
        startedAt: "desc",
      },
    });

    res.json({
      history,
      total: history.length,
    });
  } catch (error) {
    logger.error("Error getting room history:", error);
    res.status(500).json({ error: "Failed to get room history" });
  }
}
