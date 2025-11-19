// Mock payment service for testing without ePayco connectivity issues

export async function openMockCheckout({
  copAmount,
  description,
  userId,
}: {
  copAmount: number;
  description: string;
  userId: string;
}) {
  const USD_RATE = Number(import.meta.env.VITE_USD_RATE || "4000");
  const usdAmount = (copAmount / USD_RATE).toFixed(2);
  const reference = `BJ-${Date.now()}`;

  // Simular un modal de pago
  return new Promise<void>((resolve) => {
    const mockPaymentHTML = `
      <div id="mock-payment-modal" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          padding: 32px;
          max-width: 400px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        ">
          <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #333;">Pago de Prueba</h2>
          <p style="color: #666; margin: 8px 0;">
            <strong>Descripción:</strong> ${description}
          </p>
          <p style="color: #666; margin: 8px 0;">
            <strong>Monto:</strong> $${usdAmount} USD (${copAmount} COP)
          </p>
          <p style="color: #666; margin: 8px 0;">
            <strong>Referencia:</strong> ${reference}
          </p>
          <p style="color: #999; font-size: 12px; margin: 16px 0 0 0;">
            Este es un pago de prueba. Haz clic en "Confirmar Pago" para simular una transacción exitosa.
          </p>
          <div style="display: flex; gap: 8px; margin-top: 24px;">
            <button id="mock-cancel-btn" style="
              flex: 1;
              padding: 10px;
              border: 1px solid #ccc;
              background: #f5f5f5;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            ">Cancelar</button>
            <button id="mock-confirm-btn" style="
              flex: 1;
              padding: 10px;
              border: none;
              background: #4CAF50;
              color: white;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
            ">Confirmar Pago</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", mockPaymentHTML);

    const modal = document.getElementById("mock-payment-modal");
    const confirmBtn = document.getElementById("mock-confirm-btn");
    const cancelBtn = document.getElementById("mock-cancel-btn");

    const cleanup = () => {
      modal?.remove();
    };

    confirmBtn?.addEventListener("click", async () => {
      cleanup();

      // Simular redirección a landing page con parámetros
      const params = new URLSearchParams({
        ref_payco: reference,
        x_amount: usdAmount,
        x_currency_code: "USD",
        x_response: "Aprobado",
        x_cust_id_cliente: userId,
      });

      window.location.href = `/profile/payments/epayco/landing?${params.toString()}`;
      resolve();
    });

    cancelBtn?.addEventListener("click", () => {
      cleanup();
      resolve();
    });
  });
}
