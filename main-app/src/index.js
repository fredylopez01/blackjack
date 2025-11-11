import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { logger } from "./utils/logger.js";
import { setupRabbitMQ } from "./services/rabbitmq.service.js";
import { healthCheckMiddleware } from "./middleware/healthCheck.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";

// Routes
import roomRoutes from "./routes/room.routes.js";
import rankingRoutes from "./routes/ranking.routes.js";
import historyRoutes from "./routes/history.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Prisma Client
export const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check middleware (detecta si PostgreSQL está caído)
app.use(healthCheckMiddleware);

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "main-app",
    timestamp: new Date().toISOString(),
    dbStatus: res.locals.dbStatus || "unknown",
  });
});

app.use("/api/rooms", roomRoutes);
app.use("/api/ranking", rankingRoutes);
app.use("/api/history", historyRoutes);

// Error handler
app.use(errorHandler);

// Inicialización
async function bootstrap() {
  try {
    // Conectar a la base de datos
    await prisma.$connect();
    logger.info("Connected to PostgreSQL Main");

    // Configurar RabbitMQ
    await setupRabbitMQ();
    logger.info("Connected to RabbitMQ");

    // Iniciar servidor
    app.listen(PORT, () => {
      logger.info(`Main App running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start Main App:", error);
    process.exit(1);
  }
}

// Manejo de señales de terminación
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
