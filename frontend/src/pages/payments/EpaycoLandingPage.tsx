import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader } from "lucide-react";
import toast from "react-hot-toast";

export default function EpaycoLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Extraer ref_payco de la URL
        const params = new URLSearchParams(location.search);
        const reference = params.get("ref_payco");

        console.log("Landing page - URL params:", Object.fromEntries(params));
        setDebugInfo(`Referencia: ${reference}`);

        if (!reference) {
          console.error("No reference found in URL");
          setDebugInfo("Error: No reference found");
          toast.error("Referencia de pago no encontrada");
          setTimeout(() => navigate("/profile"), 2000);
          return;
        }

        // Esperar un poco a que ePayco procese
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Consultar el estado del pago en ePayco a través del backend
        console.log("Querying backend for reference:", reference);
        setDebugInfo(`Consultando backend para: ${reference}`);

        const response = await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/payments/epayco/query/${reference}`
        );

        console.log("Backend response status:", response.status);
        const data = await response.json();
        console.log("Backend response data:", data);
        setDebugInfo(`Respuesta backend: ${JSON.stringify(data).substring(0, 100)}`);

        if (data.success && data.transaction) {
          const transaction = data.transaction;
          console.log("Transaction found:", transaction);
          
          // Verificar el pago y actualizar balance
          const verifyResponse = await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/payments/epayco/verify`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                reference,
                userId: transaction.x_cust_id_cliente,
                amount: transaction.x_amount,
              }),
            }
          );

          const verifyData = await verifyResponse.json();
          console.log("Verify response:", verifyData);
          setDebugInfo(`Verificación: ${verifyData.message}`);

          if (verifyData.success) {
            toast.success("¡Pago confirmado y balance actualizado!");
            setTimeout(() => {
              navigate("/profile", { state: { refreshProfile: true } });
            }, 1500);
          } else {
            toast.error("Pago verificado pero no se pudo actualizar el balance");
            setTimeout(() => navigate("/profile"), 2000);
          }
        } else {
          console.error("Transaction not found:", data);
          setDebugInfo("Error: Transacción no encontrada");
          toast.error("No se pudo obtener el estado del pago");
          setTimeout(() => navigate("/profile"), 2000);
        }
      } catch (error) {
        console.error("Error processing payment:", error);
        setDebugInfo(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        toast.error("Error procesando el pago");
        setTimeout(() => navigate("/profile"), 2000);
      } finally {
        setIsProcessing(false);
      }
    };

    processPayment();
  }, [location.search, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 flex items-center justify-center p-4">
      <div className="text-center text-white max-w-md">
        <Loader size={48} className="animate-spin mx-auto mb-4 text-green-400" />
        <p className="text-xl font-semibold">Procesando tu pago...</p>
        <p className="text-gray-400 mt-2">Por favor espera mientras verificamos tu transacción</p>
        {debugInfo && (
          <div className="mt-6 p-3 bg-gray-800 rounded text-xs text-gray-300 text-left">
            <p className="font-mono break-words">{debugInfo}</p>
          </div>
        )}
      </div>
    </div>
  );
}
