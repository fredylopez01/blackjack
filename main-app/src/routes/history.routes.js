import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  getMyHistory,
  getRoomHistory,
  saveGameHistory,
  updatePlayerRankings,
} from "../controllers/gameHistory.controller.js";

const router = Router();

// Rutas GET (públicas)
router.get("/me", authMiddleware, getMyHistory);
router.get("/room/:roomId", getRoomHistory);

// Rutas POST (desde game-engine)
// Guardar historial de partida completada
router.post("/save", saveGameHistory);

// Actualizar rankings de jugadores
router.post("/rankings/update", updatePlayerRankings);

export default router;
