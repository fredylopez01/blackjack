import amqp from "amqplib";
import { logger } from "../utils/logger.js";

let connection = null;
let channel = null;

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672";

// Nombres de colas y exchanges
export const QUEUES = {
  PENDING_WRITES: "pending-writes",
  GAME_EVENTS: "game-events",
  DEAD_LETTER: "dead-letter-queue",
};

export const EXCHANGES = {
  GAME_EVENTS: "game-events-exchange",
};

/**
 * Configura la conexión a RabbitMQ y crea las colas necesarias
 */
export async function setupRabbitMQ() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Configurar Dead Letter Queue
    await channel.assertQueue(QUEUES.DEAD_LETTER, { durable: true });

    // Cola de escrituras pendientes (cuando PostgreSQL cae)
    await channel.assertQueue(QUEUES.PENDING_WRITES, {
      durable: true,
      deadLetterExchange: "",
      deadLetterQueue: QUEUES.DEAD_LETTER,
      messageTtl: 86400000, // 24 horas
    });

    // Exchange para eventos de juego
    await channel.assertExchange(EXCHANGES.GAME_EVENTS, "topic", {
      durable: true,
    });

    // Cola de eventos de juego
    await channel.assertQueue(QUEUES.GAME_EVENTS, { durable: true });
    await channel.bindQueue(
      QUEUES.GAME_EVENTS,
      EXCHANGES.GAME_EVENTS,
      "game.*"
    );

    logger.info("✅ RabbitMQ queues and exchanges configured");

    // Manejo de errores de conexión
    connection.on("error", (err) => {
      logger.error("RabbitMQ connection error:", err);
    });

    connection.on("close", () => {
      logger.warn("RabbitMQ connection closed. Attempting to reconnect...");
      setTimeout(setupRabbitMQ, 5000);
    });
  } catch (error) {
    logger.error("Failed to setup RabbitMQ:", error);
    throw error;
  }
}

/**
 * Publica un mensaje en una cola
 */
export async function publishToQueue(queue, message, options = {}) {
  try {
    if (!channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    const content = Buffer.from(JSON.stringify(message));
    return channel.sendToQueue(queue, content, {
      persistent: true,
      ...options,
    });
  } catch (error) {
    logger.error(`Failed to publish to queue ${queue}:`, error);
    return false;
  }
}

/**
 * Publica un evento en el exchange
 */
export async function publishEvent(routingKey, event) {
  try {
    if (!channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    const content = Buffer.from(JSON.stringify(event));
    return channel.publish(EXCHANGES.GAME_EVENTS, routingKey, content, {
      persistent: true,
    });
  } catch (error) {
    logger.error(`Failed to publish event ${routingKey}:`, error);
    return false;
  }
}

/**
 * Publica una escritura pendiente cuando PostgreSQL está caído
 */
export async function publishPendingWrite(operation, data) {
  const message = {
    operation,
    data,
    timestamp: new Date().toISOString(),
    attempts: 0,
  };

  return publishToQueue(QUEUES.PENDING_WRITES, message);
}

/**
 * Obtiene el canal actual
 */
export function getChannel() {
  return channel;
}

/**
 * Cierra la conexión a RabbitMQ
 */
export async function closeRabbitMQ() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    logger.info("RabbitMQ connection closed");
  } catch (error) {
    logger.error("Error closing RabbitMQ:", error);
  }
}
