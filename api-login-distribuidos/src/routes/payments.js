const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// Webhook de confirmacion de ePayco (sin autenticacion, ePayco lo llama directamente)
router.post("/epayco/confirmation", paymentController.confirmEpaycoPayment);

// Consultar estado de un pago (sin autenticacion, para verificar desde frontend)
router.get("/epayco/status/:reference", paymentController.getPaymentStatus);

// Verificar pago directamente con ePayco y actualizar balance
router.post("/epayco/verify", paymentController.verifyPaymentWithEpayco);

// Consultar detalles de una transacción en ePayco
router.get("/epayco/query/:reference", paymentController.queryEpaycoTransaction);

module.exports = router;
