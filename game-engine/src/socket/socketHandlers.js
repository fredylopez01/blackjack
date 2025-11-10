import { Server } from "socket.io";
import { GameManager } from "../game/GameManager.js";
import { logger } from "../utils/logger.js";
import axios from "axios";
import jwt from "jsonwebtoken";

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3001";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

/**
 * Autentica el token JWT
 */
async function authenticateSocket(token) {
  try {
    // Verificar token localmente
    const decoded = jwt.verify(token, JWT_SECRET);

    // Validar con Auth Service
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/users/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 5000,
    });

    if (response.status === 200 && response.data) {
      return {
        userId: response.data.id,
        username: response.data.email,
        balance: response.data.balance || 1000,
      };
    }

    return null;
  } catch (error) {
    logger.error("Socket authentication failed:", error);
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
    logger.info(`Socket connected: ${username} (${userId})`);

    /**
     * Unirse a una sala de juego
     */
    socket.on("join-room", async (data) => {
      try {
        const { roomId } = data;
        const { userId, username, balance } = socket.data;

        const success = await gameManager.assignPlayerToRoom(
          roomId,
          {
            userId,
            username,
            balance,
            socketId: socket.id,
          },
          socket
        );

        if (success) {
          socket.data.roomId = roomId;
          socket.emit("room-joined", {
            roomId,
            message: "Successfully joined the game",
          });
        } else {
          socket.emit("error", {
            message: "Failed to join room",
          });
        }
      } catch (error) {
        logger.error("Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
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
    socket.on("disconnect", async (reason) => {
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
