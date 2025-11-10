import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  getGlobalRanking,
  getMyStats,
} from "../controllers/ranking.controller.js";

const router = Router();

router.get("/", getGlobalRanking);
router.get("/me", authMiddleware, getMyStats);

export default router;
