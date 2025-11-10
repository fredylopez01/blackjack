import { Router } from "express";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../middleware/auth.middleware.js";
import {
  createRoom,
  listRooms,
  getRoomDetails,
  joinRoom,
  deleteRoom,
} from "../controllers/room.controller.js";

const router = Router();

/**
 * POST /api/rooms
 * Crear una nueva sala de juego
 * Requiere autenticación
 */
router.post("/", authMiddleware, createRoom);

/**
 * GET /api/rooms
 * Listar todas las salas disponibles
 * Auth opcional (usuarios autenticados ven más info)
 */
router.get("/", optionalAuthMiddleware, listRooms);

/**
 * GET /api/rooms/:id
 * Obtener detalles de una sala específica
 */
router.get("/:id", optionalAuthMiddleware, getRoomDetails);

/**
 * POST /api/rooms/:id/join
 * Solicitar unirse a una sala
 * Requiere autenticación
 */
router.post("/:id/join", authMiddleware, joinRoom);

/**
 * DELETE /api/rooms/:id
 * Eliminar una sala (solo el creador)
 * Requiere autenticación
 */
router.delete("/:id", authMiddleware, deleteRoom);

export default router;
