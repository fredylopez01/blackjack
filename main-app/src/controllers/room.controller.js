import { prisma } from "../index.js";
import { logger } from "../utils/logger.js";
import { publishPendingWrite } from "../services/rabbitmq.service.js";
import { isDatabaseHealthy } from "../middleware/healthCheck.middleware.js";
import Joi from "joi";
import axios from "axios";

const GAME_ENGINE_URL = process.env.GAME_ENGINE_URL;

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
 * Crear una nueva sala de juego - CON RESILIENCIA
 */
export async function createRoom(req, res) {
  try {
    const { error, value } = createRoomSchema.validate(req.body);
    if (error) throw new Error(error.details[0].message);

    const roomData = {
      ...value,
      createdBy: req.user.email,
      status: "WAITING",
    };

    // PASO 1: SIEMPRE registrar en Game Engine (memoria)
    let gameEngineRoom;
    try {
      const response = await axios.post(`${GAME_ENGINE_URL}/internal/rooms`, {
        name: roomData.name,
        maxPlayers: roomData.maxPlayers,
        minBet: roomData.minBet,
        maxBet: roomData.maxBet,
        isPublic: roomData.isPublic,
        password: roomData.password,
        createdBy: roomData.createdBy,
      });

      gameEngineRoom = response.data;
      logger.info(`Room ${gameEngineRoom.roomId} registered in Game Engine`);
    } catch (error) {
      logger.error("Failed to register room in Game Engine:", error);
      return res.status(503).json({
        error: "Game Engine unavailable. Cannot create room.",
      });
    }

    // PASO 2: Intentar persistir en PostgreSQL
    if (!isDatabaseHealthy()) {
      // Modo degradado: encolar operación
      logger.warn("Database unavailable. Queueing room creation...");

      await publishPendingWrite("CREATE_ROOM", {
        ...roomData,
        id: gameEngineRoom.roomId, // Usar el ID generado por game-engine
      });

      return res.status(201).json({
        message: "Room created successfully (degraded mode)",
        room: {
          id: gameEngineRoom.roomId,
          name: roomData.name,
          isPublic: roomData.isPublic,
          maxPlayers: roomData.maxPlayers,
          minBet: roomData.minBet,
          maxBet: roomData.maxBet,
          status: "WAITING",
          createdAt: new Date().toISOString(),
          createdBy: roomData.createdBy,
        },
        warning:
          "Room created in memory. Will be persisted when database recovers.",
        mode: "degraded",
      });
    }

    // Base de datos disponible: persistir normalmente
    try {
      const room = await prisma.room.create({
        data: {
          id: gameEngineRoom.roomId, // Usar mismo ID que game-engine
          ...roomData,
        },
      });

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
          createdBy: room.createdBy,
        },
        mode: "normal",
      });
    } catch (dbError) {
      logger.error("Database write failed after health check passed:", dbError);

      // Encolar como fallback
      await publishPendingWrite("CREATE_ROOM", {
        ...roomData,
        id: gameEngineRoom.roomId,
      });

      return res.status(201).json({
        message: "Room created successfully (degraded mode)",
        room: {
          id: gameEngineRoom.roomId,
          name: roomData.name,
          isPublic: roomData.isPublic,
          maxPlayers: roomData.maxPlayers,
          minBet: roomData.minBet,
          maxBet: roomData.maxBet,
          status: "WAITING",
          createdAt: new Date().toISOString(),
          createdBy: roomData.createdBy,
        },
        warning: "Room created but database write queued.",
        mode: "degraded",
      });
    }
  } catch (error) {
    logger.error("Error in createRoom:", error);
    res.status(500).json({
      error: "Failed to create room",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Listar todas las salas disponibles - CON FALLBACK A GAME ENGINE
 */
export async function listRooms(req, res) {
  try {
    const { isPublic } = req.query;

    // Verificar si la BD está disponible
    if (!isDatabaseHealthy()) {
      // Modo degradado: obtener del Game Engine
      try {
        const response = await axios.get(`${GAME_ENGINE_URL}/internal/rooms`);

        return res.json({
          rooms: response.data || [],
          source: "game-engine",
          mode: "degraded",
          warning: "Showing active rooms only. Historical data unavailable.",
        });
      } catch (error) {
        logger.error("Failed to fetch rooms from Game Engine:", error);
        return res.status(503).json({
          error: "Service temporarily unavailable",
          message: "Cannot retrieve rooms data",
        });
      }
    }

    // Base de datos disponible: consultar normalmente
    const where = {};
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
      source: "database",
      mode: "normal",
    });
  } catch (error) {
    logger.error("Error listing rooms:", error);

    // Fallback a Game Engine incluso si falla la consulta
    try {
      const response = await axios.get(`${GAME_ENGINE_URL}/internal/rooms`);

      return res.json({
        rooms: response.data || [],
        source: "game-engine",
        mode: "degraded",
        warning: "Database error. Showing active rooms from memory.",
      });
    } catch (fallbackError) {
      res.status(500).json({
        error: "Failed to list rooms",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}

/**
 * Obtener detalles de una sala - CON FALLBACK
 */
export async function getRoomDetails(req, res) {
  try {
    const { id } = req.params;

    if (!isDatabaseHealthy()) {
      // Fallback a Game Engine
      try {
        const response = await axios.get(
          `${GAME_ENGINE_URL}/internal/rooms/${id}`
        );

        return res.json({
          room: response.data,
          source: "game-engine",
          mode: "degraded",
          warning: "Historical data unavailable.",
        });
      } catch (error) {
        return res.status(404).json({
          error: "Room not found or unavailable",
        });
      }
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
      // Fallback a Game Engine
      try {
        const response = await axios.get(
          `${GAME_ENGINE_URL}/internal/rooms/${id}`
        );

        return res.json({
          room: response.data,
          source: "game-engine",
          mode: "degraded",
          warning: "Room found in memory only.",
        });
      } catch (error) {
        return res.status(404).json({ error: "Room not found" });
      }
    }

    res.json({
      room,
      source: "database",
      mode: "normal",
    });
  } catch (error) {
    logger.error("Error getting room details:", error);
    res.status(500).json({ error: "Failed to get room details" });
  }
}

/**
 * Solicitar unirse a una sala - VALIDACIÓN CON FALLBACK
 */
export async function joinRoom(req, res) {
  try {
    const { id } = req.params;
    const { password } = req.body;

    let room = null;
    let source = "database";

    // Intentar obtener de BD primero
    if (isDatabaseHealthy()) {
      try {
        room = await prisma.room.findUnique({ where: { id } });
      } catch (error) {
        logger.warn("Database query failed, falling back to Game Engine");
      }
    }

    // Fallback a Game Engine si no se encontró en BD
    if (!room) {
      try {
        const response = await axios.get(
          `${GAME_ENGINE_URL}/internal/rooms/${id}`
        );
        room = response.data;
        source = "game-engine";
      } catch (error) {
        return res.status(404).json({ error: "Room not found" });
      }
    }

    // Validar estado de sala
    if (room.status === "CLOSED") {
      return res.status(400).json({ error: "Room is closed" });
    }

    // Validar contraseña para salas privadas
    if (!room.isPublic) {
      if (req.user.email !== room.createdBy) {
        if (!password || password !== room.password) {
          return res.status(403).json({ error: "Invalid room password" });
        }
      }
    }

    logger.info(
      `User ${req.user.id} validated to join room ${id} (source: ${source})`
    );

    res.json({
      message: "Validation successful",
      room,
      source,
      success: true,
    });
  } catch (error) {
    logger.error("Error joining room:", error);
    res.status(500).json({ error: "Failed to join room" });
  }
}

/**
 * Eliminar una sala
 */
export async function deleteRoom(req, res) {
  try {
    const { id } = req.params;

    if (!isDatabaseHealthy()) {
      await publishPendingWrite("DELETE_ROOM", {
        roomId: id,
        userId: req.user.email,
      });

      return res.status(202).json({
        message: "Room deletion queued",
        mode: "degraded",
      });
    }

    const room = await prisma.room.findUnique({ where: { id } });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.createdBy !== req.user.email) {
      return res.status(403).json({ error: "Only room creator can delete it" });
    }

    await prisma.room.update({
      where: { id },
      data: { status: "CLOSED" },
    });

    res.json({
      message: "Room deleted successfully",
      mode: "normal",
    });
  } catch (error) {
    logger.error("Error deleting room:", error);
    res.status(500).json({ error: "Failed to delete room" });
  }
}
