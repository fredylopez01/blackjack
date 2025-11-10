import { Server } from "socket.io";
import { BlackjackGame } from "./BlackjackGame.js";
import { logger } from "../utils/logger.js";

/**
 * Gestiona todas las partidas activas y el matchmaking
 */
export class GameManager {
  constructor(io) {
    this.io = io;
    this.games = new Map();
    this.roomConfigs = new Map();
    this.playerToRoom = new Map();
  }

  /**
   * Registra una nueva sala
   */
  registerRoom(config) {
    this.roomConfigs.set(config.roomId, config);
    logger.info(`Room registered: ${config.roomId}`);
  }

  /**
   * Asigna un jugador a una sala
   */
  async assignPlayerToRoom(roomId, player, socket) {
    try {
      const config = this.roomConfigs.get(roomId);

      if (!config) {
        logger.error(`Room ${roomId} not found`);
        return false;
      }

      // Verificar si ya existe un juego para esta sala
      let game = this.games.get(roomId);

      if (!game) {
        // Crear nuevo juego
        game = new BlackjackGame(
          roomId,
          config.minBet,
          config.maxBet,
          config.maxPlayers,
          this.io
        );
        this.games.set(roomId, game);
        logger.info(`New game created for room ${roomId}`);
      }

      // Intentar agregar el jugador
      const added = await game.addPlayer(player, socket);

      if (added) {
        this.playerToRoom.set(player.userId, roomId);
        socket.join(roomId);
        logger.info(`Player ${player.username} joined room ${roomId}`);
      }

      return added;
    } catch (error) {
      logger.error("Error assigning player to room:", error);
      return false;
    }
  }

  /**
   * Remueve un jugador de su sala actual
   */
  async removePlayer(userId, socketId) {
    const roomId = this.playerToRoom.get(userId);

    if (!roomId) {
      return;
    }

    const game = this.games.get(roomId);

    if (game) {
      await game.removePlayer(userId, socketId);

      // Si no quedan jugadores, eliminar el juego después de un tiempo
      if (game.getPlayerCount() === 0) {
        setTimeout(() => {
          if (game.getPlayerCount() === 0) {
            this.games.delete(roomId);
            logger.info(`Game ${roomId} removed (no players)`);
          }
        }, 60000); // 1 minuto
      }
    }

    this.playerToRoom.delete(userId);
  }

  /**
   * Obtiene el juego de una sala
   */
  getGame(roomId) {
    return this.games.get(roomId);
  }

  /**
   * Obtiene el juego donde está un jugador
   */
  getPlayerGame(userId) {
    const roomId = this.playerToRoom.get(userId);
    return roomId ? this.games.get(roomId) : undefined;
  }

  /**
   * Obtiene la sala donde está un jugador
   */
  getPlayerRoom(userId) {
    return this.playerToRoom.get(userId);
  }

  /**
   * Obtiene el número de juegos activos
   */
  getActiveGamesCount() {
    return this.games.size;
  }

  /**
   * Obtiene información de salas activas
   */
  getActiveRooms() {
    const rooms = [];

    for (const [roomId, game] of this.games.entries()) {
      rooms.push({
        roomId,
        playerCount: game.getPlayerCount(),
        status: game.getStatus(),
        currentRound: game.getCurrentRound(),
      });
    }

    return rooms;
  }

  /**
   * Cierra todos los juegos (para shutdown graceful)
   */
  async shutdown() {
    logger.info("Shutting down all games...");

    for (const [roomId, game] of this.games.entries()) {
      try {
        await game.endGame();
      } catch (error) {
        logger.error(`Error ending game ${roomId}:`, error);
      }
    }

    this.games.clear();
    this.playerToRoom.clear();
    this.roomConfigs.clear();
  }
}
