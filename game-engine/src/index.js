import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { logger } from "./utils/logger.js";
import { setupRabbitMQ } from "./services/rabbitmq.service.js";
import { GameManager } from "./game/GameManager.js";
import { setupSocketHandlers } from "./socket/socketHandlers.js";
import internalRoutes from "./routes/internal.routes.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3002;

// Prisma Client
export const prisma = new PrismaClient();

// Socket.IO con CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/game/socket.io",
  transports: ["websocket", "polling"],
});

// Game Manager global
export const gameManager = new GameManager(io);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "game-engine",
    timestamp: new Date().toISOString(),
    activeGames: gameManager.getActiveGamesCount(),
  });
});

app.use("/internal", internalRoutes);

// Setup Socket.IO handlers
setupSocketHandlers(io, gameManager);

// Inicialización
async function bootstrap() {
  try {
    // Conectar a la base de datos
    await prisma.$connect();
    logger.info("✅ Connected to PostgreSQL Game DB");

    // Configurar RabbitMQ
    await setupRabbitMQ();
    logger.info("✅ Connected to RabbitMQ");

    // Iniciar servidor
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Game Engine running on port ${PORT}`);
      logger.info(
        `🎮 WebSocket endpoint: ws://localhost:${PORT}/game/socket.io`
      );
    });
  } catch (error) {
    logger.error("❌ Failed to start Game Engine:", error);
    process.exit(1);
  }
}

// Manejo de señales de terminación
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await gameManager.shutdown();
  await prisma.$disconnect();
  httpServer.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  await gameManager.shutdown();
  await prisma.$disconnect();
  httpServer.close();
  process.exit(0);
});

bootstrap();
