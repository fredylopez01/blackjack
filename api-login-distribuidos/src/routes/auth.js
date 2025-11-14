const express = require("express");
const router = express.Router();
const { login, getServiceToken } = require("../controllers/authController");
const { validateLogin } = require("../middleware/validation");

// POST /login - Iniciar sesión
router.post("/login", validateLogin, login);

// POST /service-token - Obtener token de servicio (sin validación de usuario)
router.post("/service-token", getServiceToken);

// POST /logout - Cerrar sesión
// POST /refresh - Renovar token
// GET /validate - Validar token actual

module.exports = router;
