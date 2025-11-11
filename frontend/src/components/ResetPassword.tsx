import { authAPI } from "../services/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

interface ResetPasswordProps {
  changeView: (view: string) => void;
}

export function ResetPassword({ changeView }: ResetPasswordProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Login
      const response = await authAPI.forgotPassword(email);

      toast.success(response.message);
      navigate("/lobby");
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.response?.data?.error || "Reset password error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-2xl p-8 mb-24">
      <h1 className="text-center py-2 px-4 rounded-l-lg font-semibold text-gray-300 text-2xl mb-8">
        Reset password
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
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="your@email.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Reseting..." : "Reset password"}
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
