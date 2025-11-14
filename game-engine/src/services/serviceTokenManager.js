import axios from "axios";
import { logger } from "../utils/logger.js";

const AUTH_API_URL = process.env.AUTH_API_URL || "http://localhost:3000";
const SERVICE_KEY = process.env.SERVICE_KEY;

/**
 * Gestor de tokens de servicio
 * Mantiene un token válido y lo regenera automáticamente cuando expira
 */
class ServiceTokenManager {
  constructor() {
    this.token = null;
    this.expiresAt = null;
    this.refreshInterval = null;
    this.isRefreshing = false;
  }

  /**
   * Inicializa el gestor obteniendo el primer token
   */
  async initialize() {
    if (!SERVICE_KEY) {
      logger.error(
        "SERVICE_KEY no configurada en variables de entorno. La sincronización de saldos no funcionará."
      );
      return false;
    }

    try {
      await this.refreshToken();

      // Configurar refresh automático cada 11 horas (el token expira en 12h)
      this.refreshInterval = setInterval(() => {
        this.refreshToken();
      }, 23 * 60 * 60 * 1000); // 11 horas

      logger.info("ServiceTokenManager inicializado correctamente");
      return true;
    } catch (error) {
      logger.error("Error inicializando ServiceTokenManager:", error.message);
      return false;
    }
  }

  /**
   * Obtiene un nuevo token de la API
   */
  async refreshToken() {
    if (this.isRefreshing) {
      // Si ya está refrescando, esperar a que termine
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isRefreshing) {
            clearInterval(checkInterval);
            resolve(this.token);
          }
        }, 100);
      });
    }

    this.isRefreshing = true;

    try {
      const response = await axios.post(
        `${AUTH_API_URL}/api/auth/service-token`,
        { serviceKey: SERVICE_KEY },
        {
          timeout: 5000,
        }
      );

      this.token = response.data.token;
      // Calcular expiration: 12 horas menos 2 minuto de buffer
      this.expiresAt = Date.now() + 24 * 60 * 60 * 1000 - 120 * 1000;

      logger.info("Service token renovado exitosamente");
      return this.token;
    } catch (error) {
      logger.error("Error refrescando service token:", error.message);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Obtiene un token válido, regenerando si es necesario
   */
  async getValidToken() {
    // Si no hay token, obtener uno
    if (!this.token) {
      return await this.refreshToken();
    }

    // Si el token está próximo a expirar (menos de 5 minutos), renovar
    if (Date.now() > this.expiresAt - 5 * 60 * 1000) {
      logger.info("Service token próximo a expirar, renovando...");
      return await this.refreshToken();
    }

    return this.token;
  }

  /**
   * Obtiene headers HTTP con el token de autorización
   */
  async getAuthHeaders() {
    const token = await this.getValidToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Limpia recursos al cerrar
   */
  shutdown() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      logger.info("ServiceTokenManager detenido");
    }
  }
}

export const serviceTokenManager = new ServiceTokenManager();
