import axios from "axios";
import { logger } from "../utils/logger.js";

const MAIN_APP_URL = process.env.MAIN_APP_URL || "http://localhost:3001";

/**
 * Servicio para sincronizar datos de partidas con main-app
 */
export class MainAppSyncService {
  /**
   * Enviar historial de partida completada a main-app
   */
  static async saveGameHistory(gameData) {
    try {
      const response = await axios.post(
        `${MAIN_APP_URL}/api/history/save`,
        gameData,
        {
          timeout: 10000,
        }
      );

      logger.info(`Game history sent to main-app: ${gameData.gameEngineId}`);
      return response.data;
    } catch (error) {
      logger.error("Error sending game history to main-app:", error.message);
      throw error;
    }
  }

  /**
   * Actualizar rankings de jugadores en main-app
   */
  static async updateRankings(rankingData) {
    try {
      const response = await axios.post(
        `${MAIN_APP_URL}/api/history/rankings/update`,
        rankingData,
        {
          timeout: 10000,
        }
      );

      logger.info(
        `Rankings updated in main-app for ${rankingData.results.length} players`
      );
      return response.data;
    } catch (error) {
      logger.error("Error updating rankings in main-app:", error.message);
      throw error;
    }
  }

  /**
   * Enviar ambos datos (historial + rankings) de forma segura
   * Con reintentos en caso de fallo
   */
  static async syncGameCompletion(gameData, rankingData, maxRetries = 3) {
    let historySuccess = false;
    let rankingSuccess = false;

    // Intentar guardar historial
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.saveGameHistory(gameData);
        historySuccess = true;
        break;
      } catch (error) {
        logger.warn(
          `Failed to save game history (attempt ${attempt}/${maxRetries}): ${error.message}`
        );

        if (attempt === maxRetries) {
          logger.error(
            `Failed to save game history after ${maxRetries} attempts`
          );
        } else {
          // Esperar antes de reintentar
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    // Intentar actualizar rankings
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.updateRankings(rankingData);
        rankingSuccess = true;
        break;
      } catch (error) {
        logger.warn(
          `Failed to update rankings (attempt ${attempt}/${maxRetries}): ${error.message}`
        );

        if (attempt === maxRetries) {
          logger.error(
            `Failed to update rankings after ${maxRetries} attempts`
          );
        } else {
          // Esperar antes de reintentar
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    return {
      historySuccess,
      rankingSuccess,
      allSuccess: historySuccess && rankingSuccess,
    };
  }
}
