import toast from "react-hot-toast";
import { authAPI } from "../services/api";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface LoginProps {
  changeView: (view: string) => void;
}

export function Login({ changeView }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const [passwordError, setPasswordError] = useState("");

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const validatePassword = (password: string): boolean => {
    const minLen = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < minLen) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres");
      return false;
    }
    if (!hasUppercase) {
      setPasswordError(
        "La contraseña debe contener al menos una letra mayúscula"
      );
      return false;
    }
    if (!hasSpecialChar) {
      setPasswordError(
        "La contraseña debe contener al menos un carácter especial"
      );
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePassword(password)) {
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const response = await authAPI.login(email, password);

        // Obtener perfil del usuario
        const profile = await authAPI.getProfile();

        login(response.token, {
          id: profile.data.user.id,
          email: profile.data.user.email,
          role: profile.data.user.role || "user",
          balance: profile.data.user.balance || 1000,
        });

        toast.success("Welcome back!");
        navigate("/lobby");
      } else {
        // Register
        await authAPI.register(email, password);
        toast.success("Account created! Please login");
        setIsLogin(true);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-2xl p-8 mb-24">
      <div className="flex mb-6">
        <button
          onClick={() => setIsLogin(true)}
          aria-label="Switch to login view"
          className={`flex-1 py-2 px-4 rounded-l-lg font-semibold transition ${
            isLogin
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Login
        </button>
        <button
          onClick={() => setIsLogin(false)}
          aria-label="Switch to register view"
          className={`flex-1 py-2 px-4 rounded-r-lg font-semibold transition ${
            !isLogin
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Password
          </label>
          <div className="w-full flex items-center gap-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500">
            <input
              id="password"
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="flex-1 bg-gray-700 text-white focus:outline-none"
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
          {passwordError && (
            <p className="text-red-500 text-sm mt-1">{passwordError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          data-testid="login-submit-button"
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : isLogin ? "Login" : "Create Account"}
        </button>
      </form>

      <div className="flex gap-4 mt-6 text-center">
        <button
          onClick={() => changeView("reset-password")}
          className="text-sm text-green-400 hover:text-green-300"
        >
          Reset password
        </button>
        <button
          onClick={() => changeView("forgot-password")}
          className="text-sm text-green-400 hover:text-green-300"
        >
          Forgot password?
        </button>
      </div>
    </div>
  );
}
