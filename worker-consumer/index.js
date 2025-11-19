import amqp from "amqplib";
import { PrismaClient } from "@prisma/client";
import { logger } from "./utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const WORKER_RETRY_MAX_ATTEMPTS =
  parseInt(process.env.WORKER_RETRY_MAX_ATTEMPTS) || 5;
const WORKER_RETRY_BASE_DELAY =
  parseInt(process.env.WORKER_RETRY_BASE_DELAY) || 2000;

const QUEUES = {
  PENDING_WRITES: "pending-writes",
  GAME_EVENTS: "game-events",
};

const prisma = new PrismaClient();
let connection = null;
let channel = null;
let isProcessing = false;

/**
 * Verifica si la base de datos está disponible
 */
async function isDatabaseHealthy() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Conecta a RabbitMQ con reintentos
 */
async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Asegurar que las colas necesarias existan
    await channel.assertQueue(QUEUES.PENDING_WRITES, { durable: true });
    await channel.assertQueue(QUEUES.GAME_EVENTS, { durable: true });

    // Configurar prefetch
    await channel.prefetch(1);

    logger.info("Connected to RabbitMQ");

    // Manejo de errores
    connection.on("error", (err) => {
      logger.error("RabbitMQ connection error:", err);
      setTimeout(connectRabbitMQ, 5000);
    });

    connection.on("close", () => {
      logger.warn("RabbitMQ connection closed. Reconnecting...");
      setTimeout(connectRabbitMQ, 5000);
    });

    // Iniciar consumidores
    await startConsumers();
  } catch (error) {
    logger.error("Failed to connect to RabbitMQ:", error);
    setTimeout(connectRabbitMQ, 5000);
  }
}

/**
 * Inicia los consumidores
 */
async function startConsumers() {
  if (!channel) return;

  // Consumidor de escrituras pendientes
  await channel.consume(QUEUES.PENDING_WRITES, handlePendingWrite, {
    noAck: false,
  });

  // Consumidor de eventos de juego
  await channel.consume(QUEUES.GAME_EVENTS, handleGameEvent, {
    noAck: false,
  });

  logger.info("Consumers started and waiting for messages");
}

/**
 * Procesa una escritura pendiente con reintentos inteligentes
 */
async function handlePendingWrite(msg) {
  if (!msg || !channel) return;

  // Evitar procesar múltiples mensajes en paralelo
  if (isProcessing) {
    setTimeout(() => handlePendingWrite(msg), 1000);
    return;
  }

  isProcessing = true;

  try {
    const content = JSON.parse(msg.content.toString());
    const { operation, data, attempts = 0 } = content;

    logger.info(
      `[QUEUE] Processing: ${operation} (attempt ${
        attempts + 1
      }/${WORKER_RETRY_MAX_ATTEMPTS})`
    );

    // Verificar si la BD está disponible antes de procesar
    const dbHealthy = await isDatabaseHealthy();

    if (!dbHealthy) {
      logger.warn(
        `[QUEUE] Database still unavailable. Requeuing ${operation}...`
      );

      // Esperar más tiempo antes de reintentar
      setTimeout(() => {
        if (channel) {
          channel.nack(msg, false, true); // Requeue
        }
        isProcessing = false;
      }, 10000); // 10 segundos

      return;
    }

    // Procesar la operación
    let success = false;

    switch (operation) {
      case "CREATE_ROOM":
        success = await createRoom(data);
        break;

      case "UPDATE_RANKINGS":
        success = await updateRankings(data);
        break;

      case "DELETE_ROOM":
        success = await deleteRoom(data);
        break;

      case "SAVE_GAME_HISTORY":
        success = await saveGameHistory(data);
        break;

      default:
        logger.warn(`[QUEUE] Unknown operation: ${operation}`);
        channel.ack(msg); // Acknowledge para no reprocesar
        isProcessing = false;
        return;
    }

    if (success) {
      // Operación exitosa
      channel.ack(msg);
      logger.info(`[QUEUE] ✓ Successfully processed: ${operation}`);
      isProcessing = false;
    } else {
      // Reintentar con backoff exponencial
      const newAttempts = attempts + 1;

      if (newAttempts < WORKER_RETRY_MAX_ATTEMPTS) {
        const delay = Math.min(
          WORKER_RETRY_BASE_DELAY * Math.pow(2, newAttempts),
          30000
        );

        logger.warn(
          `[QUEUE] ⚠ Failed ${operation}, retrying in ${delay}ms (${newAttempts}/${WORKER_RETRY_MAX_ATTEMPTS})`
        );

        setTimeout(() => {
          if (channel) {
            const retryContent = Buffer.from(
              JSON.stringify({
                ...content,
                attempts: newAttempts,
              })
            );

            channel.sendToQueue(QUEUES.PENDING_WRITES, retryContent, {
              persistent: true,
            });
            channel.ack(msg);
          }
          isProcessing = false;
        }, delay);
      } else {
        // Máximos intentos alcanzados
        logger.error(
          `[QUEUE] ✗ Max attempts reached for ${operation}. Moving to DLQ.`
        );
        channel.nack(msg, false, false); // Dead letter
        isProcessing = false;
      }
    }
  } catch (error) {
    logger.error("[QUEUE] Error processing message:", error);

    // Requeue con delay
    setTimeout(() => {
      if (channel) {
        channel.nack(msg, false, true);
      }
      isProcessing = false;
    }, 5000);
  }
}

/**
 * Procesa eventos de juego
 */
async function handleGameEvent(msg) {
  if (!msg || !channel) return;

  try {
    const content = JSON.parse(msg.content.toString());
    const routingKey = msg.fields.routingKey;

    logger.info(`[EVENT] Processing: ${routingKey}`);

    switch (routingKey) {
      case "game.round.completed":
        await handleRoundCompleted(content);
        break;

      case "game.player.busted":
        await handlePlayerBusted(content);
        break;

      case "game.room.closed":
        await handleRoomClosed(content);
        break;

      default:
        logger.info(`[EVENT] Unhandled: ${routingKey}`);
    }

    channel.ack(msg);
  } catch (error) {
    logger.error("[EVENT] Error processing:", error);
    channel.ack(msg); // Acknowledge para no bloquear la cola
  }
}

// ========================================
// OPERACIONES DE BASE DE DATOS
// ========================================

async function createRoom(data) {
  try {
    logger.info(`[DB] Creating room: ${data.id || "new"}`);

    // Verificar si ya existe
    const existing = await prisma.room.findUnique({
      where: { id: data.id },
    });

    if (existing) {
      logger.info(`[DB] Room ${data.id} already exists. Skipping.`);
      return true;
    }

    await prisma.room.create({
      data: {
        ...data,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info(`[DB] ✓ Room created: ${data.id}`);
    return true;
  } catch (error) {
    logger.error(`[DB] Error creating room:`, error);
    return false;
  }
}

async function updateRankings(data) {
  try {
    const { results } = data;
    logger.info(`[DB] Updating rankings for ${results.length} players`);

    for (const result of results) {
      const { userId, username, profit, roundsWon, roundsLost } = result;

      let ranking = await prisma.playerRanking.findUnique({
        where: { userId },
      });

      if (!ranking) {
        await prisma.playerRanking.create({
          data: {
            userId,
            username,
            totalGames: 1,
            gamesWon: roundsWon > roundsLost ? 1 : 0,
            gamesLost: roundsLost > roundsWon ? 1 : 0,
            totalProfit: profit,
            winRate: roundsWon > roundsLost ? 100 : 0,
            lastPlayed: new Date(),
          },
        });
      } else {
        const newTotalGames = ranking.totalGames + 1;
        const newGamesWon = ranking.gamesWon + (roundsWon > roundsLost ? 1 : 0);
        const newGamesLost =
          ranking.gamesLost + (roundsLost > roundsWon ? 1 : 0);
        const newTotalProfit = ranking.totalProfit + profit;
        const newWinRate =
          newTotalGames > 0 ? (newGamesWon / newTotalGames) * 100 : 0;

        await prisma.playerRanking.update({
          where: { userId },
          data: {
            totalGames: newTotalGames,
            gamesWon: newGamesWon,
            gamesLost: newGamesLost,
            totalProfit: newTotalProfit,
            winRate: newWinRate,
            lastPlayed: new Date(),
          },
        });
      }
    }

    // Actualizar ranks
    await updateAllRanks();

    logger.info(`[DB] ✓ Rankings updated for ${results.length} players`);
    return true;
  } catch (error) {
    logger.error(`[DB] Error updating rankings:`, error);
    return false;
  }
}

async function deleteRoom(data) {
  try {
    logger.info(`[DB] Deleting room: ${data.roomId}`);

    await prisma.room.update({
      where: { id: data.roomId },
      data: { status: "CLOSED" },
    });

    logger.info(`[DB] ✓ Room deleted: ${data.roomId}`);
    return true;
  } catch (error) {
    logger.error(`[DB] Error deleting room:`, error);
    return false;
  }
}

async function saveGameHistory(data) {
  try {
    logger.info(`[DB] Saving game history: ${data.gameEngineId}`);

    // Verificar si ya existe
    const existing = await prisma.gameHistory.findFirst({
      where: { gameEngineId: data.gameEngineId },
    });

    if (existing) {
      logger.info(
        `[DB] Game history ${data.gameEngineId} already exists. Skipping.`
      );
      return true;
    }

    await prisma.gameHistory.create({
      data: {
        ...data,
        startedAt: new Date(data.startedAt),
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
      },
    });

    logger.info(`[DB] ✓ Game history saved: ${data.gameEngineId}`);
    return true;
  } catch (error) {
    logger.error(`[DB] Error saving game history:`, error);
    return false;
  }
}

async function updateAllRanks() {
  try {
    const allRankings = await prisma.playerRanking.findMany({
      orderBy: [{ totalProfit: "desc" }, { winRate: "desc" }],
    });

    for (let i = 0; i < allRankings.length; i++) {
      await prisma.playerRanking.update({
        where: { userId: allRankings[i].userId },
        data: { rank: i + 1 },
      });
    }

    logger.info(`[DB] All ranks updated (${allRankings.length} players)`);
  } catch (error) {
    logger.error("[DB] Error updating ranks:", error);
  }
}

// ========================================
// HANDLERS DE EVENTOS
// ========================================

async function handleRoundCompleted(data) {
  logger.info(
    `[EVENT] Round ${data.roundNumber} completed in room ${data.roomId}`
  );
  // Eventos ya se procesan en game-engine, aquí solo para logs
}

async function handlePlayerBusted(data) {
  logger.info(`[EVENT] Player busted:`, data);
}

async function handleRoomClosed(data) {
  logger.info(`[EVENT] Room closed: ${data.roomId}`);

  if (await isDatabaseHealthy()) {
    try {
      await prisma.room.update({
        where: { id: data.roomId },
        data: { status: "CLOSED" },
      });
    } catch (error) {
      logger.error("[EVENT] Error closing room:", error);
    }
  }
}

// ========================================
// INICIALIZACIÓN
// ========================================

async function bootstrap() {
  try {
    logger.info("Starting Worker Consumer...");

    // Conectar a PostgreSQL
    await prisma.$connect();
    logger.info("Connected to PostgreSQL");

    // Verificar salud de BD
    const dbHealthy = await isDatabaseHealthy();
    logger.info(`Database health: ${dbHealthy ? "healthy" : "degraded"}`);

    // Conectar a RabbitMQ e iniciar consumidores
    await connectRabbitMQ();

    logger.info("Worker Consumer started successfully");
    logger.info("Waiting for messages...");
  } catch (error) {
    logger.error("Failed to start Worker Consumer:", error);
    process.exit(1);
  }
}

// Manejo de señales de terminación
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  isProcessing = false;
  if (channel) await channel.close();
  if (connection) await connection.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  isProcessing = false;
  if (channel) await channel.close();
  if (connection) await connection.close();
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
