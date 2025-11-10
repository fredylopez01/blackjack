import { prisma } from "../index.js";
import { logger } from "../utils/logger.js";

// Estado global de la base de datos
let dbHealthy = true;
let lastCheck = Date.now();
const CHECK_INTERVAL = 10000; // 10 segundos

/**
 * Verifica la salud de PostgreSQL periódicamente
 */
async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error("Database health check failed:", error);
    return false;
  }
}

/**
 * Middleware que verifica el estado de la BD antes de cada request
 */
export async function healthCheckMiddleware(req, res, next) {
  const now = Date.now();

  // Solo verificar cada CHECK_INTERVAL para no sobrecargar
  if (now - lastCheck > CHECK_INTERVAL) {
    dbHealthy = await checkDatabaseHealth();
    lastCheck = now;
  }

  // Agregar estado al response locals para que esté disponible
  res.locals.dbStatus = dbHealthy ? "healthy" : "degraded";
  res.locals.isDbHealthy = dbHealthy;

  next();
}

/**
 * Obtiene el estado actual de la base de datos
 */
export function isDatabaseHealthy() {
  return dbHealthy;
}

/**
 * Fuerza una verificación inmediata del estado de la BD
 */
export async function forceHealthCheck() {
  dbHealthy = await checkDatabaseHealth();
  lastCheck = Date.now();
  return dbHealthy;
}
