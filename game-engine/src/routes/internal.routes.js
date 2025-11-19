import express from "express";
import { gameManager, prisma } from "../index.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

/**
 * Registra una nueva sala de juego
 * Ahora devuelve el ID generado para consistencia
 */
router.post("/rooms", async (req, res) => {
  try {
    const { name, maxPlayers, minBet, maxBet, isPublic, password, createdBy } =
      req.body;

    if (!maxPlayers || !minBet || !maxBet) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    // Generar ID único para la sala
    const roomId = `room_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    gameManager.registerRoom({
      roomId,
      name: name || `Room ${roomId.slice(0, 8)}`,
      maxPlayers,
      minBet,
      maxBet,
      isPublic: isPublic !== undefined ? isPublic : true,
      password,
      createdBy,
    });

    logger.info(`Room registered: ${roomId}`);

    res.status(201).json({
      message: "Room registered successfully",
      roomId,
      name: name || `Room ${roomId.slice(0, 8)}`,
      maxPlayers,
      minBet,
      maxBet,
      isPublic: isPublic !== undefined ? isPublic : true,
      createdBy,
    });
  } catch (error) {
    logger.error("Error registering room:", error);
    res.status(500).json({
      error: "Failed to register room",
    });
  }
});

/**
 * Obtiene información de todas las salas activas en memoria
 * ENDPOINT DE FALLBACK cuando main-app DB está caída
 */
router.get("/rooms", (req, res) => {
  try {
    const activeRooms = gameManager.getActiveRooms();

    // Enriquecer con información de configuración
    const enrichedRooms = activeRooms.map((room) => {
      const config = gameManager.roomConfigs.get(room.roomId);
      return {
        id: room.roomId,
        name: config?.name || room.roomId.slice(0, 8),
        isPublic: config?.isPublic !== undefined ? config.isPublic : true,
        maxPlayers: config?.maxPlayers || room.playerCount,
        minBet: config?.minBet || 10,
        maxBet: config?.maxBet || 1000,
        status: room.status,
        createdAt: new Date().toISOString(), // Aproximado
        createdBy: config?.createdBy || "unknown",
        currentPlayers: room.playerCount,
      };
    });

    res.json(enrichedRooms);
  } catch (error) {
    logger.error("Error getting active rooms:", error);
    res.status(500).json({
      error: "Failed to get active rooms",
    });
  }
});

/**
 * Obtiene información de una sala específica
 * ENDPOINT DE FALLBACK
 */
router.get("/rooms/:roomId", (req, res) => {
  try {
    const { roomId } = req.params;
    const game = gameManager.getGame(roomId);

    const config = gameManager.roomConfigs.get(roomId);

    if (!game && !config) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    res.json({
      id: roomId,
      name: config?.name || roomId.slice(0, 8),
      isPublic: config?.isPublic !== undefined ? config.isPublic : true,
      password: config?.password,
      maxPlayers: config?.maxPlayers || 5,
      minBet: config?.minBet || 10,
      maxBet: config?.maxBet || 1000,
      status: (game && game.getStatus()) || "WAITING",
      playerCount: (game && game.getPlayerCount()) || 0,
      currentRound: (game && game.getCurrentRound()) || 1,
      createdBy: config?.createdBy || "unknown",
    });
  } catch (error) {
    logger.error("Error getting room info:", error);
    res.status(500).json({
      error: "Failed to get room info",
    });
  }
});

/**
 * Obtiene el historial de partidas desde la BD local de game-engine
 * ENDPOINT DE FALLBACK para cuando main-app DB está caída
 */
router.get("/history/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    // Consultar en la BD local de game-engine
    const gameSessions = await prisma.gameSession.findMany({
      where: {
        players: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        players: {
          where: {
            userId: userId,
          },
        },
        rounds: {
          select: {
            id: true,
            roundNumber: true,
          },
        },
      },
      orderBy: {
        finishedAt: "desc",
      },
      take: limit,
    });

    // Formatear respuesta similar a main-app
    const history = gameSessions.map((session) => {
      const playerSession = session.players[0];

      return {
        id: session.id,
        roomId: session.roomId,
        gameEngineId: session.id,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        totalRounds: session.totalRounds,
        playersCount: session.players.length,
        results: [
          {
            userId: playerSession.userId,
            username: playerSession.username,
            profit: playerSession.currentBalance - playerSession.initialBalance,
            roundsWon: playerSession.roundsWon,
            roundsLost: playerSession.roundsLost,
            roundsPush: playerSession.roundsPush,
            finalBalance: playerSession.currentBalance,
          },
        ],
      };
    });

    res.json({
      history,
      source: "game-engine",
      warning:
        "Data from game engine database. May not include all historical games.",
    });
  } catch (error) {
    logger.error("Error getting user history from game-engine:", error);
    res.status(500).json({
      error: "Failed to get user history",
    });
  }
});

/**
 * Obtiene estadísticas del jugador desde la BD local
 * ENDPOINT DE FALLBACK para rankings
 */
router.get("/ranking/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Consultar todas las sesiones del jugador
    const playerSessions = await prisma.playerSession.findMany({
      where: {
        userId: userId,
      },
      include: {
        game: true,
      },
    });

    if (playerSessions.length === 0) {
      return res.status(404).json({
        error: "No statistics found for this user",
      });
    }

    // Calcular estadísticas agregadas
    const totalGames = playerSessions.length;
    const gamesWon = playerSessions.filter(
      (s) => s.roundsWon > s.roundsLost
    ).length;
    const gamesLost = playerSessions.filter(
      (s) => s.roundsLost > s.roundsWon
    ).length;
    const totalProfit = playerSessions.reduce(
      (sum, s) => sum + (s.currentBalance - s.initialBalance),
      0
    );
    const winRate = totalGames > 0 ? (gamesWon / totalGames) * 100 : 0;

    const stats = {
      userId,
      username: playerSessions[0].username,
      totalGames,
      gamesWon,
      gamesLost,
      totalProfit,
      winRate: Math.round(winRate * 100) / 100,
      rank: null, // No se puede calcular sin todos los jugadores
    };

    res.json({
      ...stats,
      source: "game-engine",
      warning:
        "Statistics from game engine. Rank unavailable in degraded mode.",
    });
  } catch (error) {
    logger.error("Error getting user stats from game-engine:", error);
    res.status(500).json({
      error: "Failed to get user stats",
    });
  }
});

/**
 * Obtiene ranking global parcial desde game-engine
 * ENDPOINT DE FALLBACK
 */
router.get("/ranking/global", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    // Obtener todos los jugadores únicos con sus estadísticas
    const playerSessions = await prisma.playerSession.findMany({
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Agrupar por userId y calcular totales
    const playerStats = new Map();

    for (const session of playerSessions) {
      const existing = playerStats.get(session.userId) || {
        userId: session.userId,
        username: session.username,
        totalGames: 0,
        gamesWon: 0,
        gamesLost: 0,
        totalProfit: 0,
      };

      existing.totalGames += 1;
      existing.gamesWon += session.roundsWon > session.roundsLost ? 1 : 0;
      existing.gamesLost += session.roundsLost > session.roundsWon ? 1 : 0;
      existing.totalProfit += session.currentBalance - session.initialBalance;

      playerStats.set(session.userId, existing);
    }

    // Convertir a array y calcular winRate
    const rankings = Array.from(playerStats.values())
      .map((player) => ({
        ...player,
        winRate:
          player.totalGames > 0
            ? Math.round((player.gamesWon / player.totalGames) * 100 * 100) /
              100
            : 0,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, limit)
      .map((player, index) => ({
        ...player,
        rank: index + 1,
      }));

    res.json({
      rankings,
      source: "game-engine",
      warning:
        "Partial rankings from game engine. May not include all players.",
    });
  } catch (error) {
    logger.error("Error getting global ranking from game-engine:", error);
    res.status(500).json({
      error: "Failed to get global ranking",
    });
  }
});

/**
 * Endpoint de métricas y estado del servicio
 */
router.get("/metrics", (req, res) => {
  try {
    res.json({
      status: "healthy",
      activeGames: gameManager.getActiveGamesCount(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error getting metrics:", error);
    res.status(500).json({
      error: "Failed to get metrics",
    });
  }
});

export default router;
