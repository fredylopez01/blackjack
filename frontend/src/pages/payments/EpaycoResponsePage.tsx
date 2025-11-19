import { useMemo, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navigation from "../../components/Navigation";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";

export default function EpaycoResponsePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const { status, title, message, amount, currency, reference, userId } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const response = (
      params.get("x_response") || params.get("response") || ""
    ).toLowerCase();
    const ref = params.get("x_ref_payco") || params.get("ref_payco") || "";
    const amount = params.get("x_amount") || params.get("amount") || "";
    const currency =
      params.get("x_currency_code") || params.get("currency") || "";
    const userId = params.get("x_cust_id_cliente") || params.get("customer") || "";

    let status: "success" | "failed" | "pending" = "pending";
    if (response.includes("aprob")) status = "success";
    else if (response.includes("rechaz") || response.includes("deneg"))
      status = "failed";

    let title = "Estado del pago";
    let message = response || "Revisa el estado de tu pago en ePayco.";
    if (ref) {
      message += message ? ` Ref: ${ref}` : `Referencia: ${ref}`;
    }

    return { status, title, message, amount, currency, reference: ref, userId };
  }, [location.search]);

  const StatusIcon =
    status === "success" ? CheckCircle : status === "failed" ? XCircle : Clock;
  const statusColor =
    status === "success"
      ? "text-green-400"
      : status === "failed"
      ? "text-red-400"
      : "text-yellow-400";

  useEffect(() => {
    if (status === "success" && reference && userId && !isProcessing) {
      const verifyPayment = async () => {
        setIsProcessing(true);
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/payments/epayco/verify`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                reference,
                userId,
                amount,
              }),
            }
          );

          const data = await response.json();
          
          if (data.success) {
            toast.success("¡Pago confirmado y balance actualizado!");
            // Esperar un poco antes de redirigir
            setTimeout(() => {
              navigate("/profile", { state: { refreshProfile: true } });
            }, 1500);
          } else {
            toast.error("Error verificando el pago");
            setTimeout(() => {
              navigate("/profile");
            }, 2000);
          }
        } catch (error) {
          console.error("Error verifying payment:", error);
          toast.error("Error al verificar el pago");
          setTimeout(() => {
            navigate("/profile");
          }, 2000);
        }
      };

      verifyPayment();
    } else if (status === "failed") {
      const timer = setTimeout(() => {
        navigate("/profile");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, reference, userId, navigate, isProcessing, amount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900">
      <Navigation />

      <div className="p-4 md:p-8 mt-16 md:mt-0">
        <div className="max-w-xl mx-auto bg-gray-900/80 border border-gray-700 rounded-lg p-6 md:p-8 text-center text-white">
          <div className="flex flex-col items-center gap-3 mb-6">
            <StatusIcon size={40} className={statusColor} />
            <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
          </div>

          <p className="text-gray-300 mb-4">{message}</p>

          {amount && (
            <p className="text-lg text-gray-200 mb-2">
              Monto:{" "}
              <span className="font-semibold text-green-400">
                {amount} {currency || ""}
              </span>
            </p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate("/lobby")}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
            >
              Volver al Lobby
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition"
            >
              Ver Perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
