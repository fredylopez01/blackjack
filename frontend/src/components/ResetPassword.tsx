import { authAPI } from "../services/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";

interface ResetPasswordProps {
  changeView: (view: string) => void;
}

interface FormInputs {
  email: string;
  token: string;
  newPassword: string;
}

export function ResetPassword({ changeView }: ResetPasswordProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInputs>();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const onSubmit = async (data: FormInputs) => {
    setLoading(true);
    try {
      const response = await authAPI.resetPassword(data);
      toast.success(response.message);
      navigate("/lobby");
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast.error(error.response?.data?.message || "Reset password error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-2xl p-8 mb-2">
      <h1 className="text-center py-1 px-4 rounded-l-lg font-semibold text-gray-300 text-2xl mb-4">
        Reset Password
      </h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            {...register("email", {
              required: "El email es obligatorio",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Formato de email inválido",
              },
            })}
            className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 ${
              errors.email
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-600 focus:ring-green-500"
            }`}
            placeholder="your@email.com"
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Token
          </label>
          <input
            type="text"
            {...register("token", { required: "El token es obligatorio" })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Reset token"
          />
          {errors.token && (
            <p className="text-red-500 text-sm mt-1">{errors.token.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            New Password
          </label>
          <div className="w-full flex items-center gap-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500">
            <input
              id="password"
              type={isPasswordVisible ? "text" : "password"}
              {...register("newPassword", {
                required: "La contraseña es obligatoria",
                minLength: {
                  value: 8,
                  message: "Mínimo 8 caracteres",
                },
                pattern: {
                  value: /^(?=.*[!@#$%^&*])/,
                  message: "Debe contener al menos un carácter especial",
                },
              })}
              required
              minLength={8}
              className={`flex-1 bg-gray-700 text-white focus:outline-none ${
                errors.newPassword
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-600 focus:ring-green-500"
              }`}
              placeholder="••••••••"
            />
            <button
              type="button"
              aria-label="Toggle password visibility"
              onClick={() => setIsPasswordVisible(!isPasswordVisible)}
            >
              {isPasswordVisible ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="text-red-500 text-sm mt-1">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>
      <div className="mt-6 text-center">
        <button
          onClick={() => changeView("login")}
          className="text-sm text-green-400 hover:text-green-300"
        >
          Go Login
        </button>
      </div>
    </div>
  );
}
