const User = require("../models/User");
const { writeErrorLog } = require("../services/fileService");
const { logUserAction } = require("../middleware/logger");
const crypto = require("crypto");
const axios = require("axios");

const confirmEpaycoPayment = async (req, res) => {
  try {
    // Log para debugging
    console.log("ePayco confirmation received:", JSON.stringify(req.body, null, 2));

    const {
      x_cust_id_cliente,
      x_customer,
      customer,
      x_ref_payco,
      x_transaction_state,
      x_amount,
      x_currency_code,
      x_signature,
    } = req.body;

    // Usar el primer ID disponible (ePayco puede enviar en diferentes formatos)
    const userId = x_cust_id_cliente || x_customer || customer;

    // Validar campos requeridos
    if (!userId || !x_ref_payco || !x_transaction_state) {
      console.error("Missing required fields:", { userId, x_ref_payco, x_transaction_state });
      return res.status(400).json({
        message: "Campos requeridos faltantes",
        success: false,
      });
    }

    // Validar firma (opcional pero recomendado)
    if (x_signature && process.env.EPAYCO_PRIVATE_KEY) {
      const privateKey = process.env.EPAYCO_PRIVATE_KEY;
      const signatureString = `${x_ref_payco}${x_transaction_state}${x_amount}${privateKey}`;
      const expectedSignature = crypto
        .createHash("sha256")
        .update(signatureString)
        .digest("hex");

      if (x_signature !== expectedSignature) {
        await writeErrorLog({
          message: `EPAYCO-CONFIRMATION: Firma inválida para ref ${x_ref_payco}`,
          stack: `Expected: ${expectedSignature}, Got: ${x_signature}`,
        });
        return res.status(403).json({
          message: "Firma inválida",
          success: false,
        });
      }
    }

    // Solo procesar pagos aprobados (estado 1)
    if (x_transaction_state !== "1" && x_transaction_state !== 1) {
      return res.status(200).json({
        message: "Pago no aprobado, no se actualiza balance",
        success: true,
        transactionState: x_transaction_state,
      });
    }

    // Buscar usuario por ID
    const user = await User.findById(userId);
    if (!user) {
      await writeErrorLog({
        message: `EPAYCO-CONFIRMATION: Usuario no encontrado ${userId}`,
      });
      return res.status(404).json({
        message: "Usuario no encontrado",
        success: false,
      });
    }

    // Convertir monto a número
    const amountToAdd = Number(x_amount) || 0;
    if (amountToAdd <= 0) {
      return res.status(400).json({
        message: "Monto inválido",
        success: false,
      });
    }

    // Actualizar balance
    const newBalance = (user.balance || 0) + amountToAdd;
    const updatedUser = await User.update(userId, {
      balance: newBalance,
    });

    // Registrar acción
    await logUserAction(
      "PAYMENT_RECEIVED",
      userId,
      `Pago ePayco recibido: ${amountToAdd} ${x_currency_code || "USD"}, Ref: ${x_ref_payco}`
    );

    return res.status(200).json({
      message: "Pago confirmado y balance actualizado",
      success: true,
      data: {
        userId,
        newBalance,
        amountAdded: amountToAdd,
        reference: x_ref_payco,
      },
    });
  } catch (error) {
    await writeErrorLog({
      message: `EPAYCO-CONFIRMATION: Error procesando confirmación: ${error.message}`,
      stack: error.stack,
    });

    return res.status(500).json({
      message: "Error procesando confirmación",
      success: false,
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Almacenar pagos confirmados en memoria (en producción usar DB)
const confirmedPayments = new Map();
const processedPayments = new Set();

const verifyPaymentWithEpayco = async (req, res) => {
  try {
    const { reference, userId, amount } = req.body;
    
    if (!reference || !userId || !amount) {
      return res.status(400).json({
        message: "Referencia, userId y monto son requeridos",
        success: false,
      });
    }

    // Evitar procesar el mismo pago dos veces
    if (processedPayments.has(reference)) {
      return res.status(200).json({
        message: "Pago ya fue procesado",
        success: true,
        alreadyProcessed: true,
      });
    }

    // Consultar estado en ePayco
    try {
      const epaycoResponse = await axios.get(
        `https://secure.epayco.co/api/transaction/query/reference_payco/${reference}`,
        {
          params: {
            public_key: process.env.EPAYCO_PUBLIC_KEY,
          },
        }
      );

      console.log("ePayco response:", JSON.stringify(epaycoResponse.data, null, 2));

      const transaction = epaycoResponse.data?.data?.[0];
      
      if (!transaction) {
        return res.status(404).json({
          message: "Transacción no encontrada en ePayco",
          success: false,
        });
      }

      // Verificar si el pago fue aprobado (estado 1)
      if (transaction.x_transaction_state !== "1" && transaction.x_transaction_state !== 1) {
        return res.status(200).json({
          message: "Pago no aprobado",
          success: false,
          transactionState: transaction.x_transaction_state,
        });
      }

      // Buscar usuario
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: "Usuario no encontrado",
          success: false,
        });
      }

      // Actualizar balance
      const amountToAdd = Number(amount) || 0;
      if (amountToAdd <= 0) {
        return res.status(400).json({
          message: "Monto inválido",
          success: false,
        });
      }

      const newBalance = (user.balance || 0) + amountToAdd;
      await User.update(userId, { balance: newBalance });

      // Registrar acción
      await logUserAction(
        "PAYMENT_VERIFIED",
        userId,
        `Pago ePayco verificado: ${amountToAdd} USD, Ref: ${reference}`
      );

      // Marcar como procesado
      processedPayments.add(reference);
      setTimeout(() => processedPayments.delete(reference), 60 * 60 * 1000); // Limpiar después de 1 hora

      return res.status(200).json({
        message: "Pago verificado y balance actualizado",
        success: true,
        data: {
          userId,
          newBalance,
          amountAdded: amountToAdd,
          reference,
        },
      });
    } catch (epaycoError) {
      console.error("Error consultando ePayco:", epaycoError.message);
      await writeErrorLog({
        message: `EPAYCO-VERIFY: Error consultando ePayco: ${epaycoError.message}`,
        stack: epaycoError.stack,
      });

      return res.status(500).json({
        message: "Error consultando estado del pago en ePayco",
        success: false,
        error: process.env.NODE_ENV === "development" ? epaycoError.message : undefined,
      });
    }
  } catch (error) {
    await writeErrorLog({
      message: `EPAYCO-VERIFY: Error: ${error.message}`,
      stack: error.stack,
    });

    return res.status(500).json({
      message: "Error verificando pago",
      success: false,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    
    if (!reference) {
      return res.status(400).json({
        message: "Referencia de pago requerida",
        success: false,
      });
    }

    const payment = confirmedPayments.get(reference);
    
    if (!payment) {
      return res.status(404).json({
        message: "Pago no encontrado",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Pago encontrado",
      success: true,
      data: payment,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error consultando estado del pago",
      success: false,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Actualizar confirmEpaycoPayment para guardar en memoria
const originalConfirmEpaycoPayment = confirmEpaycoPayment;
const confirmEpaycoPaymentWithCache = async (req, res) => {
  const result = await originalConfirmEpaycoPayment(req, res);
  
  // Si fue exitoso, guardar en cache
  if (res.statusCode === 200 && req.body.x_ref_payco) {
    confirmedPayments.set(req.body.x_ref_payco, {
      userId: req.body.x_cust_id_cliente || req.body.x_customer || req.body.customer,
      amount: req.body.x_amount,
      timestamp: Date.now(),
    });
    
    // Limpiar después de 10 minutos
    setTimeout(() => {
      confirmedPayments.delete(req.body.x_ref_payco);
    }, 10 * 60 * 1000);
  }
  
  return result;
};

const queryEpaycoTransaction = async (req, res) => {
  try {
    const { reference } = req.params;
    
    if (!reference) {
      return res.status(400).json({
        message: "Referencia de pago requerida",
        success: false,
      });
    }

    console.log(`Querying ePayco for reference: ${reference}`);

    // Consultar estado en ePayco
    try {
      const epaycoResponse = await axios.get(
        `https://secure.epayco.co/api/transaction/query/reference_payco/${reference}`,
        {
          params: {
            public_key: process.env.EPAYCO_PUBLIC_KEY,
          },
          timeout: 5000,
        }
      );

      console.log("ePayco query response:", JSON.stringify(epaycoResponse.data, null, 2));

      const transaction = epaycoResponse.data?.data?.[0];
      
      if (!transaction) {
        return res.status(404).json({
          message: "Transacción no encontrada en ePayco",
          success: false,
        });
      }

      return res.status(200).json({
        message: "Transacción encontrada",
        success: true,
        transaction,
      });
    } catch (epaycoError) {
      console.error("ePayco API error:", epaycoError.message);
      
      // En desarrollo, si ePayco falla, devolver una transacción simulada
      if (process.env.NODE_ENV === "development") {
        console.log("Development mode: returning simulated transaction");
        return res.status(200).json({
          message: "Transacción simulada (desarrollo)",
          success: true,
          transaction: {
            x_ref_payco: reference,
            x_amount: "10.00",
            x_currency_code: "USD",
            x_transaction_state: "1",
            x_response_reason_text: "Aprobado",
            x_cust_id_cliente: "dev-user",
          },
        });
      }

      throw epaycoError;
    }
  } catch (error) {
    console.error("Error querying ePayco:", error.message);
    await writeErrorLog({
      message: `EPAYCO-QUERY: Error consultando ePayco: ${error.message}`,
      stack: error.stack,
    });

    return res.status(500).json({
      message: "Error consultando transacción en ePayco",
      success: false,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  confirmEpaycoPayment: confirmEpaycoPaymentWithCache,
  getPaymentStatus,
  verifyPaymentWithEpayco,
  queryEpaycoTransaction,
};
