import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  getMyHistory,
  getRoomHistory,
} from "../controllers/history.controller.js";

const router = Router();

router.get("/me", authMiddleware, getMyHistory);
router.get("/room/:roomId", getRoomHistory);

export default router;
