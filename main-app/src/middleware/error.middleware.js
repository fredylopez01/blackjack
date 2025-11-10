import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }
  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Error interno del servidor",
  });
}
