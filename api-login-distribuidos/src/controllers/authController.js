const { sanitizeInput } = require("../utils/validators");
const { loginUser } = require("../services/authService");
const { logUserAction } = require("../middleware/logger");
const { writeErrorLog } = require("../services/fileService");
const { generateServiceToken } = require("../utils/tokenUtils");

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    const result = await loginUser(sanitizedEmail, password);

    if (result.error) {
      await logUserAction(
        "LOGIN_FAILED",
        null,
        `Intento fallido con email: ${sanitizedEmail}`
      );
      return res.status(401).json({ message: result.error });
    }

    await logUserAction(
      "LOGIN_SUCCESS",
      sanitizedEmail,
      "Usuario inició sesión"
    );
    return res.json({ message: "Login exitoso", token: result.token });
  } catch (error) {
    await writeErrorLog({
      message: `LOGIN-ERROR: Error en el login: ${error.message}`,
      stack: error.stack,
    });
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/**
 * Obtiene un token de servicio para sincronización entre servicios
 * Requiere una clave secreta compartida
 */
async function getServiceToken(req, res) {
  try {
    // Validar que se proporcione la clave secreta correcta
    const serviceKey = req.headers["x-service-key"] || req.body.serviceKey;
    const expectedKey = process.env.SERVICE_KEY;

    if (!expectedKey) {
      await writeErrorLog({
        message: "SERVICE_TOKEN-ERROR: SERVICE_KEY no configurada en .env",
        stack: new Error().stack,
      });
      return res.status(500).json({
        message: "Error interno del servidor",
      });
    }

    if (serviceKey !== expectedKey) {
      await logUserAction(
        "SERVICE_TOKEN_FAILED",
        null,
        "Intento fallido de obtener token de servicio"
      );
      return res.status(401).json({
        message: "Clave de servicio inválida",
      });
    }

    const token = generateServiceToken();

    await logUserAction(
      "SERVICE_TOKEN_GENERATED",
      "game-engine-service",
      "Token de servicio generado"
    );

    return res.json({
      message: "Token de servicio generado exitosamente",
      token,
      expiresIn: "12h",
    });
  } catch (error) {
    await writeErrorLog({
      message: `SERVICE_TOKEN-ERROR: Error generando token de servicio: ${error.message}`,
      stack: error.stack,
    });
    return res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}

module.exports = {
  login,
  getServiceToken,
};
