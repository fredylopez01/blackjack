import axios from "axios";
import { verifyJwtToken } from "../utils/jwtUtils.js";

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3000";

/**
 * Middleware para validar JWT usando el Auth Service
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "No authorization token provided",
    });
  }

  const token = authHeader.substring(7);

  const user = verifyJwtToken(token);

  req.user = user;
  next();
}

/**
 * Middleware opcional para validar token sin fallar si no hay
 */
export async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    const user = verifyJwtToken(token);
    req.user = user;
  }

  next();
}
