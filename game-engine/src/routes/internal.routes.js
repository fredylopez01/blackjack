import express from "express";
import { gameManager } from "../index.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

/**
 * Registra una nueva sala de juego
 */
router.post("/rooms", async (req, res) => {
  try {
    const { roomId, maxPlayers, minBet, maxBet } = req.body;

    if (!roomId || !maxPlayers || !minBet || !maxBet) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    gameManager.registerRoom({
      roomId,
      maxPlayers,
      minBet,
      maxBet,
    });

    logger.info(`Room registered: ${roomId}`);

    res.status(201).json({
      message: "Room registered successfully",
      roomId,
    });
  } catch (error) {
    logger.error("Error registering room:", error);
    res.status(500).json({
      error: "Failed to register room",
    });
  }
});

/**
 * Obtiene información de todas las salas activas
 */
router.get("/rooms", (req, res) => {
  try {
    const rooms = gameManager.getActiveRooms();
    console.log(rooms);

    res.json(rooms);
  } catch (error) {
    logger.error("Error getting active rooms:", error);
    res.status(500).json({
      error: "Failed to get active rooms",
    });
  }
});

/**
 * Obtiene información de una sala específica
 */
router.get("/rooms/:roomId", (req, res) => {
  try {
    const { roomId } = req.params;
    const game = gameManager.getGame(roomId);

    if (!game) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    res.json({
      roomId,
      status: game.getStatus(),
      playerCount: game.getPlayerCount(),
      currentRound: game.getCurrentRound(),
    });
  } catch (error) {
    logger.error("Error getting room info:", error);
    res.status(500).json({
      error: "Failed to get room info",
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
