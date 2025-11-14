import { prisma } from "../index.js";
import { logger } from "../utils/logger.js";
import { publishPendingWrite } from "../services/rabbitmq.service.js";
import { isDatabaseHealthy } from "../middleware/healthCheck.middleware.js";
import Joi from "joi";
import axios from "axios";

const GAME_ENGINE_URL = process.env.GAME_ENGINE_URL || "http://localhost:3002";

// Validación de creación de sala
const createRoomSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  isPublic: Joi.boolean().default(true),
  password: Joi.string().min(4).max(20).when("isPublic", {
    is: false,
    then: Joi.required(),
  }),
  maxPlayers: Joi.number().min(1).max(7).default(5),
  minBet: Joi.number().min(1).max(10000).default(10),
  maxBet: Joi.number().min(10).max(100000).default(1000),
  config: Joi.object().default({}),
});

/**
 * Crear una nueva sala de juego
 */
export async function createRoom(req, res) {
  const { error, value } = createRoomSchema.validate(req.body);

  if (error) throw new Error(error.details[0].message);

  const roomData = {
    ...value,
    createdBy: req.user.email,
    status: "WAITING",
  };

  // Verificar si la BD está disponible
  if (!isDatabaseHealthy()) {
    // Modo degradado: encolar operación
    logger.warn("Database unavailable. Queueing room creation...");

    await publishPendingWrite("CREATE_ROOM", roomData);

    return res.status(202).json({
      message:
        "Room creation queued. Will be created when database is available.",
      status: "pending",
    });
  }

  // Crear sala en PostgreSQL
  const room = await prisma.room.create({
    data: roomData,
  });

  // Notificar al Game Engine sobre la nueva sala
  try {
    await axios.post(`${GAME_ENGINE_URL}/internal/rooms`, {
      roomId: room.id,
      maxPlayers: room.maxPlayers,
      minBet: room.minBet,
      maxBet: room.maxBet,
    });
    logger.info(`Room ${room.id} registered in Game Engine`);
  } catch (error) {
    logger.error("Failed to notify Game Engine:", error);
  }

  res.status(201).json({
    message: "Room created successfully",
    room: {
      id: room.id,
      name: room.name,
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      minBet: room.minBet,
      maxBet: room.maxBet,
      status: room.status,
      createdAt: room.createdAt,
    },
  });
}

/**
 * Listar todas las salas disponibles
 */
export async function listRooms(req, res) {
  try {
    const { status, isPublic } = req.query;

    // Verificar si la BD está disponible
    if (!isDatabaseHealthy()) {
      // Modo degradado: intentar obtener del Game Engine
      try {
        const response = await axios.get(`${GAME_ENGINE_URL}/internal/rooms`);

        return res.json({
          rooms: response.data || [],
          source: "game-engine",
          warning: "Main database unavailable. Showing active rooms only.",
        });
      } catch (error) {
        return res.status(503).json({
          error: "Service temporarily unavailable",
          message: "Database and Game Engine unavailable",
        });
      }
    }

    const where = {};

    if (status) where.status = status;
    if (isPublic !== undefined) where.isPublic = isPublic === "true";

    const rooms = await prisma.room.findMany({
      where,
      select: {
        id: true,
        name: true,
        isPublic: true,
        maxPlayers: true,
        minBet: true,
        maxBet: true,
        status: true,
        createdAt: true,
        createdBy: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      rooms,
      total: rooms.length,
    });
  } catch (error) {
    logger.error("Error listing rooms:", error);
    res.status(500).json({ error: "Failed to list rooms" });
  }
}

/**
 * Obtener detalles de una sala
 */
export async function getRoomDetails(req, res) {
  try {
    const { id } = req.params;

    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        gameHistory: {
          take: 10,
          orderBy: {
            startedAt: "desc",
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({ room });
  } catch (error) {
    logger.error("Error getting room details:", error);
    res.status(500).json({ error: "Failed to get room details" });
  }
}

/**
 * Solicitar unirse a una sala
 */
export async function joinRoom(req, res) {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!isDatabaseHealthy()) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.status === "CLOSED") {
      return res.status(400).json({ error: "Room is closed" });
    }

    if (!room.isPublic) {
      if (req.user.email !== room.createdBy) {
        if (!password || password !== room.password) {
          return res.status(403).json({ error: "Invalid room password" });
        }
      }
    }

    // SIMPLEMENTE VALIDAR Y RESPONDER
    // El socket se encargará de unirse realmente
    logger.info(`User ${req.user.id} validated to join room ${id}`);

    res.json({
      message: "Validation successful",
      room,
      success: true,
    });
  } catch (error) {
    logger.error("Error joining room:", error);
    res.status(500).json({ error: "Failed to join room" });
  }
}

/**
 * Eliminar una sala (solo el creador)
 */
export async function deleteRoom(req, res) {
  try {
    const { id } = req.params;

    if (!isDatabaseHealthy()) {
      await publishPendingWrite("DELETE_ROOM", {
        roomId: id,
        userId: req.user.userId,
      });
      return res.status(202).json({
        message: "Room deletion queued",
      });
    }

    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.createdBy !== req.user.userId) {
      return res.status(403).json({ error: "Only room creator can delete it" });
    }

    await prisma.room.update({
      where: { id },
      data: { status: "CLOSED" },
    });

    res.json({ message: "Room deleted successfully" });
  } catch (error) {
    logger.error("Error deleting room:", error);
    res.status(500).json({ error: "Failed to delete room" });
  }
}
