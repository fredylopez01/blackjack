import amqp from "amqplib";
import { PrismaClient } from "@prisma/client";
import { logger } from "./utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const DATABASE_URL = process.env.DATABASE_URL;

const QUEUES = {
  PENDING_WRITES: "pending-writes",
  GAME_EVENTS: "game-events",
};

const prisma = new PrismaClient();
let connection = null;
let channel = null;

/**
 * Conecta a RabbitMQ
 */
async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Configurar prefetch para procesar un mensaje a la vez
    await channel.prefetch(1);

    logger.info("Connected to RabbitMQ");

    // Configurar manejo de errores
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
 * Inicia los consumidores de las colas
 */
async function startConsumers() {
  if (!channel) return;

  // Consumidor de escrituras pendientes
  await channel.consume(QUEUES.PENDING_WRITES, handlePendingWrite, {
    noAck: false,
  });

  // Consumidor de eventos de juego
  await channel.consume(QUEUES.GAME_EVENTS, handleGameEvent, { noAck: false });

  logger.info("Consumers started");
}

/**
 * Procesa una escritura pendiente
 */
async function handlePendingWrite(msg) {
  if (!msg || !channel) return;

  try {
    const content = JSON.parse(msg.content.toString());
    const { operation, data, attempts = 0 } = content;

    logger.info(`Processing pending write: ${operation}`);

    // Intentar realizar la escritura
    let success = false;

    switch (operation) {
      case "CREATE_ROOM":
        success = await createRoom(data);
        break;

      case "UPDATE_RANKING":
        success = await updateRanking(data);
        break;

      case "DELETE_ROOM":
        success = await deleteRoom(data);
        break;

      case "SAVE_GAME_HISTORY":
        success = await saveGameHistory(data);
        break;

      default:
        logger.warn(`Unknown operation: ${operation}`);
        success = false;
    }

    if (success) {
      // Acknowledge: operación exitosa
      channel.ack(msg);
      logger.info(`Successfully processed: ${operation}`);
    } else {
      // Reintento con backoff exponencial
      const maxAttempts = 5;
      const newAttempts = attempts + 1;

      if (newAttempts < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, newAttempts), 30000);

        logger.warn(
          `Failed ${operation}, retrying in ${delay}ms (attempt ${newAttempts}/${maxAttempts})`
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
        }, delay);
      } else {
        // Máximos intentos alcanzados, mover a DLQ
        logger.error(`Max attempts reached for ${operation}, moving to DLQ`);
        channel.nack(msg, false, false);
      }
    }
  } catch (error) {
    logger.error("Error processing pending write:", error);

    // Requeue el mensaje para reintentarlo después
    if (channel) {
      channel.nack(msg, false, true);
    }
  }
}

/**
 * Procesa un evento de juego
 */
async function handleGameEvent(msg) {
  if (!msg || !channel) return;

  try {
    const content = JSON.parse(msg.content.toString());
    const routingKey = msg.fields.routingKey;

    logger.info(`Processing game event: ${routingKey}`);

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
        logger.info(`Unhandled event: ${routingKey}`);
    }

    channel.ack(msg);
  } catch (error) {
    logger.error("Error processing game event:", error);

    if (channel) {
      channel.ack(msg); // Acknowledge para no reprocesar indefinidamente
    }
  }
}

/**
 * Operaciones de base de datos
 */

async function createRoom(data) {
  try {
    await prisma.room.create({ data });
    return true;
  } catch (error) {
    logger.error("Error creating room:", error);
    return false;
  }
}

async function updateRanking(data) {
  try {
    const { userId, username, gamesWon, gamesLost, totalProfit } = data;

    await prisma.playerRanking.upsert({
      where: { userId },
      update: {
        gamesWon,
        gamesLost,
        totalProfit,
        winRate: gamesWon / (gamesWon + gamesLost),
        lastPlayed: new Date(),
      },
      create: {
        userId,
        username,
        totalGames: gamesWon + gamesLost,
        gamesWon,
        gamesLost,
        totalProfit,
        winRate: gamesWon / (gamesWon + gamesLost),
      },
    });

    return true;
  } catch (error) {
    logger.error("Error updating ranking:", error);
    return false;
  }
}

async function deleteRoom(data) {
  try {
    await prisma.room.update({
      where: { id: data.roomId },
      data: { status: "CLOSED" },
    });
    return true;
  } catch (error) {
    logger.error("Error deleting room:", error);
    return false;
  }
}

async function saveGameHistory(data) {
  try {
    await prisma.gameHistory.create({ data });
    return true;
  } catch (error) {
    logger.error("Error saving game history:", error);
    return false;
  }
}

/**
 * Handlers de eventos de juego
 */

async function handleRoundCompleted(data) {
  const { roomId, roundNumber, results } = data;

  // Actualizar ranking de jugadores
  for (const result of results) {
    const { userId, username, result: outcome, payout } = result;

    try {
      const ranking = await prisma.playerRanking.findUnique({
        where: { userId },
      });

      const gamesWon = ranking?.gamesWon || 0;
      const gamesLost = ranking?.gamesLost || 0;
      const totalGames = ranking?.totalGames || 0;
      const totalProfit = ranking?.totalProfit || 0;

      await prisma.playerRanking.upsert({
        where: { userId },
        update: {
          totalGames: totalGames + 1,
          gamesWon: outcome === "win" ? gamesWon + 1 : gamesWon,
          gamesLost: outcome === "lose" ? gamesLost + 1 : gamesLost,
          totalProfit: totalProfit + (payout || 0),
          winRate:
            outcome === "win"
              ? (gamesWon + 1) / (totalGames + 1)
              : gamesWon / (totalGames + 1),
          lastPlayed: new Date(),
        },
        create: {
          userId,
          username,
          totalGames: 1,
          gamesWon: outcome === "win" ? 1 : 0,
          gamesLost: outcome === "lose" ? 1 : 0,
          totalProfit: payout || 0,
          winRate: outcome === "win" ? 1 : 0,
        },
      });
    } catch (error) {
      logger.error(`Error updating ranking for user ${userId}:`, error);
    }
  }

  logger.info(`Processed round ${roundNumber} for room ${roomId}`);
}

async function handlePlayerBusted(data) {
  logger.info("Player busted event:", data);
}

async function handleRoomClosed(data) {
  const { roomId } = data;

  try {
    await prisma.room.update({
      where: { id: roomId },
      data: { status: "CLOSED" },
    });
  } catch (error) {
    logger.error("Error closing room:", error);
  }
}

/**
 * Inicialización
 */
async function bootstrap() {
  try {
    // Conectar a PostgreSQL
    await prisma.$connect();
    logger.info("Connected to PostgreSQL");

    // Conectar a RabbitMQ e iniciar consumidores
    await connectRabbitMQ();

    logger.info("Worker Consumer started successfully");
  } catch (error) {
    logger.error("Failed to start Worker Consumer:", error);
    process.exit(1);
  }
}

// Manejo de señales de terminación
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  if (channel) await channel.close();
  if (connection) await connection.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  if (channel) await channel.close();
  if (connection) await connection.close();
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
