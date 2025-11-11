// game-engine/src/socket/socketHandlers.js
import { Server } from "socket.io";
import { GameManager } from "../game/GameManager.js";
import { logger } from "../utils/logger.js";
import axios from "axios";
import jwt from "jsonwebtoken";

const MAIN_APP_URL = process.env.MAIN_APP_URL || "http://localhost:3001";
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Autentica el token JWT
 */
async function authenticateSocket(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      userId: decoded.id,
      username: decoded.email,
      balance: decoded.balance || 1000,
    };
  } catch (error) {
    logger.error("Socket authentication failed:", error);
    return null;
  }
}

/**
 * Carga la configuración de una sala desde el Main App
 */
async function loadRoomConfig(roomId) {
  try {
    const response = await axios.get(`${MAIN_APP_URL}/api/rooms/${roomId}`, {
      timeout: 5000,
    });

    if (response.status === 200 && response.data.room) {
      const room = response.data.room;
      return {
        roomId: room.id,
        maxPlayers: room.maxPlayers,
        minBet: room.minBet,
        maxBet: room.maxBet,
      };
    }

    return null;
  } catch (error) {
    logger.error(`Failed to load room config for ${roomId}:`, error.message);
    return null;
  }
}

/**
 * Configura todos los handlers de Socket.IO
 */
export function setupSocketHandlers(io, gameManager) {
  // Middleware de autenticación
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      const userData = await authenticateSocket(token);

      if (!userData) {
        return next(new Error("Invalid token"));
      }

      socket.data = userData;
      next();
    } catch (error) {
      logger.error("Socket middleware error:", error);
      next(new Error("Authentication failed"));
    }
  });

  // Conexión establecida
  io.on("connection", (socket) => {
    const { userId, username } = socket.data;
    logger.info(`Socket connected: ${username} (${userId}) - ${socket.id}`);

    /**
     * Unirse a una sala de juego
     */
    socket.on("join-room", async (data) => {
      try {
        const { roomId, token } = data;
        const decoded = jwt.verify(token, JWT_SECRET);

        logger.info(
          `User ${decoded.email} (${decoded.id}) attempting to join room ${roomId}`
        );

        // Si el usuario ya está en una sala, sacarlo primero
        const existingRoomId = socket.data.roomId;
        if (existingRoomId && existingRoomId !== roomId) {
          const existingGame = gameManager.getGame(existingRoomId);
          if (existingGame) {
            await existingGame.removePlayer(decoded.id, socket.id);
            logger.info(
              `User ${decoded.id} removed from previous room ${existingRoomId}`
            );
          }
        }

        // Si ya está en esta sala, solo confirmar
        const game = gameManager.getGame(roomId);
        if (game && game.players.has(decoded.id)) {
          socket.data.roomId = roomId;
          socket.emit("room-joined", {
            roomId,
            message: "Already in the game",
            players: game.getPlayersInfo(),
          });
          logger.info(`User ${decoded.email} already in room ${roomId}`);
          return;
        }

        // CARGAR CONFIGURACIÓN DE LA SALA SI NO EXISTE
        if (!gameManager.roomConfigs.has(roomId)) {
          logger.info(`Room ${roomId} not registered, loading config...`);

          const config = await loadRoomConfig(roomId);

          if (!config) {
            socket.emit("error", { message: "Room not found or unavailable" });
            logger.error(`Room ${roomId} config not found`);
            return;
          }

          gameManager.registerRoom(config);
          logger.info(`Room ${roomId} registered:`, config);
        }

        // Intentar asignar al jugador
        const success = await gameManager.assignPlayerToRoom(
          roomId,
          {
            userId: decoded.id,
            username: decoded.email,
            balance: 1000,
            socketId: socket.id,
          },
          socket
        );

        if (success) {
          socket.data.roomId = roomId;
          socket.emit("room-joined", {
            roomId,
            message: "Successfully joined the game",
            players: game.getPlayersInfo(),
          });
          logger.info(
            `User ${decoded.email} successfully joined room ${roomId}`
          );
        } else {
          socket.emit("error", {
            message: "Failed to join room (room full or other issue)",
          });
          logger.warn(`User ${decoded.email} failed to join room ${roomId}`);
        }
      } catch (error) {
        logger.error("Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    /**
     * Iniciar juego (solo creador)
     */
    socket.on("start-game", async () => {
      try {
        const { userId, roomId } = socket.data;

        if (!roomId) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const game = gameManager.getGame(roomId);

        if (!game) {
          socket.emit("error", { message: "Game not found" });
          return;
        }

        logger.info(
          `User ${userId} requesting to start game in room ${roomId}`
        );

        // Por ahora, permitir que cualquiera inicie (puedes agregar validación de creador)
        // TODO: Verificar que el usuario sea el creador de la sala

        if (game.getPlayerCount() < 2) {
          socket.emit("error", { message: "Need at least 2 players to start" });
          return;
        }

        if (game.getStatus() !== "WAITING") {
          socket.emit("error", { message: "Game already started" });
          return;
        }

        // Iniciar fase de apuestas
        game.startBettingPhase();
        logger.info(`🎮 Game started in room ${roomId}`);
      } catch (error) {
        logger.error("Error starting game:", error);
        socket.emit("error", { message: "Failed to start game" });
      }
    });

    /**
     * Realizar apuesta
     */
    socket.on("place-bet", async (data) => {
      try {
        const { userId, roomId } = socket.data;

        if (!roomId) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const game = gameManager.getGame(roomId);

        if (!game) {
          socket.emit("error", { message: "Game not found" });
          return;
        }

        const success = await game.placeBet(userId, data.amount);

        if (success) {
          socket.emit("bet-placed-success", {
            amount: data.amount,
          });
          logger.info(`💰 User ${userId} bet ${data.amount}`);
        } else {
          socket.emit("error", {
            message: "Invalid bet amount or insufficient balance",
          });
        }
      } catch (error) {
        logger.error("Error placing bet:", error);
        socket.emit("error", { message: "Failed to place bet" });
      }
    });

    /**
     * Pedir carta (hit)
     */
    socket.on("hit", async () => {
      try {
        const { userId, roomId } = socket.data;

        if (!roomId) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const game = gameManager.getGame(roomId);

        if (!game) {
          socket.emit("error", { message: "Game not found" });
          return;
        }

        const success = await game.hit(userId);

        if (!success) {
          socket.emit("error", { message: "Cannot hit at this time" });
        }
      } catch (error) {
        logger.error("Error hitting:", error);
        socket.emit("error", { message: "Failed to hit" });
      }
    });

    /**
     * Plantarse (stand)
     */
    socket.on("stand", async () => {
      try {
        const { userId, roomId } = socket.data;

        if (!roomId) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const game = gameManager.getGame(roomId);

        if (!game) {
          socket.emit("error", { message: "Game not found" });
          return;
        }

        const success = await game.stand(userId);

        if (!success) {
          socket.emit("error", { message: "Cannot stand at this time" });
        }
      } catch (error) {
        logger.error("Error standing:", error);
        socket.emit("error", { message: "Failed to stand" });
      }
    });

    /**
     * Obtener estado del juego
     */
    socket.on("get-game-state", () => {
      const { roomId } = socket.data;

      if (!roomId) {
        socket.emit("error", { message: "Not in a room" });
        return;
      }

      const game = gameManager.getGame(roomId);

      if (game) {
        socket.emit("game-state", {
          status: game.getStatus(),
          round: game.getCurrentRound(),
          playerCount: game.getPlayerCount(),
        });
      }
    });

    /**
     * Desconexión
     */
    socket.on("leave-room", async (reason) => {
      try {
        const { userId, username } = socket.data;
        logger.info(`Socket disconnected: ${username} (${reason})`);

        if (userId) {
          await gameManager.removePlayer(userId, socket.id);
        }
      } catch (error) {
        logger.error("Error handling disconnect:", error);
      }
    });

    /**
     * Manejo de errores
     */
    socket.on("error", (error) => {
      logger.error("Socket error:", error);
    });
  });
}
