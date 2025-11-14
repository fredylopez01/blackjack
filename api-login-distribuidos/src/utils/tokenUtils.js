const jwt = require("jsonwebtoken");

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, balance: user.balance },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
}

/**
 * Genera un token para servicios internos (ej: game-engine)
 * Tiene una duración más larga que los tokens de usuario
 */
function generateServiceToken() {
  return jwt.sign(
    {
      id: "game-engine-service",
      role: "service",
      type: "service",
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" } // Válido por 12 horas
  );
}

module.exports = {
  generateToken,
  generateServiceToken,
};
