import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../store/authStore";

export default function EpaycoLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
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

        if (!user?.id) {
          console.error("No user ID found");
          setDebugInfo("Error: Usuario no autenticado");
          toast.error("Usuario no autenticado");
          setTimeout(() => navigate("/profile"), 2000);
          return;
        }

        // Esperar un poco a que ePayco procese
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Consultar el estado del pago en ePayco Y acreditar saldo
        console.log("Querying ePayco transaction for reference:", reference, "userId:", user.id);
        setDebugInfo(`Consultando ePayco para: ${reference}`);

        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(
          `${apiUrl}/api/payments/epayco/query/${reference}?userId=${user.id}`
        );

        console.log("ePayco query response:", response.status);
        const data = await response.json();
        console.log("ePayco query data:", data);
        setDebugInfo(`Respuesta ePayco: ${JSON.stringify(data).substring(0, 120)}`);

        if (data.success && data.approved) {
          toast.success(`¡Pago confirmado! Nuevo balance: $${data.newBalance || data.user?.balance || "N/A"}`);
          setTimeout(() => {
            navigate("/profile", { state: { refreshProfile: true } });
          }, 1500);
        } else if (data.success && data.approved === false) {
          toast.error("Pago no aprobado por ePayco");
          setTimeout(() => navigate("/profile"), 2000);
        } else if (data.success && data.alreadyApplied) {
          toast.success("Pago ya procesado anteriormente");
          setTimeout(() => navigate("/profile"), 1500);
        } else {
          console.error("Payment query failed:", data);
          setDebugInfo(`Error: ${data.message || "Estado desconocido"}`);
          toast.error(data.message || "No se pudo obtener el estado del pago");
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
  }, [location.search, navigate, user?.id]);

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
