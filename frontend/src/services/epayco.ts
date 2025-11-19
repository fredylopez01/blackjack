// frontend/src/services/epayco.ts

declare global {
  interface Window {
    ePayco?: any;
  }
}

const PUBLIC_KEY = import.meta.env.VITE_EPAYCO_PUBLIC_KEY;
const USD_RATE = Number(import.meta.env.VITE_USD_RATE || "4000");

interface OpenCheckoutParams {
  copAmount: number;
  description: string;
  userId: string;
}

export async function openCheckout({ 
  copAmount, 
  description, 
  userId
}: OpenCheckoutParams) {
  if (!window.ePayco || !window.ePayco.checkout) {
    throw new Error("La librer de ePayco no esta cargada.");
  }

  if (!PUBLIC_KEY) {
    throw new Error("Falta configurar VITE_EPAYCO_PUBLIC_KEY.");
  }

  if (!USD_RATE || Number.isNaN(USD_RATE)) {
    throw new Error("VITE_USD_RATE no es vaIida.");
  }

  const usdAmount = (copAmount / USD_RATE).toFixed(2);

  const handler = window.ePayco.checkout.configure({
    key: PUBLIC_KEY,
    test: true,
    // Configuración adicional para ambiente de pruebas
    env: "test",
  });

  handler.open({
    name: "Blackjack Chips",
    description,
    currency: "USD",
    amount: usdAmount,
    country: "CO",
    external: false,
    // response: redirige a nuestra página landing que procesa el pago
    response: `${window.location.origin}/profile/payments/epayco/landing`,
    // confirmation: webhook para que ePayco notifique al backend
    confirmation: `${window.location.origin.replace("localhost:5173", "localhost:3000")}/api/payments/epayco/confirmation`,
    invoice: `BJ-${Date.now()}`,
    tax: "0",
    tax_base: usdAmount,
    tip: "0",
    customer: userId,
    // Evitar validaciones de IP
    test: true,
  });
}

export {};
