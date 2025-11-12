import { authAPI } from "../services/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

interface ResetPasswordProps {
  changeView: (view: string) => void;
}

export function ResetPassword({ changeView }: ResetPasswordProps) {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    // Simple regex para validar email
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres";
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
    if (!passwordRegex.test(password)) {
      return "La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 símbolo";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let valid = true;

    // Validar email
    if (!validateEmail(email)) {
      setEmailError("Formato de email inválido");
      valid = false;
    } else {
      setEmailError("");
    }

    // Validar contraseña
    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setPasswordError(pwdError);
      valid = false;
    } else {
      setPasswordError("");
    }

    if (!valid) return;

    setLoading(true);

    try {
      // Reset password
      const response = await authAPI.resetPassword({
        email,
        newPassword,
        token,
      });

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
    <div className="bg-gray-800 rounded-lg shadow-2xl p-8 mb-24">
      <h1 className="text-center py-2 px-4 rounded-l-lg font-semibold text-gray-300 text-2xl mb-8">
        Reset Password
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 ${
              emailError
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-600 focus:ring-green-500"
            }`}
            placeholder="your@email.com"
          />
          {emailError && (
            <p className="text-red-500 text-sm mt-1">{emailError}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Token
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Reset token"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 ${
              passwordError
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-600 focus:ring-green-500"
            }`}
            placeholder="New password"
          />
          {passwordError && (
            <p className="text-red-500 text-sm mt-1">{passwordError}</p>
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
