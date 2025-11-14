import { Eye, EyeOff } from "lucide-react";
import { roomsAPI } from "../services/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { Room } from "../interfaces/Room";

export function CreateRoomModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [minBet, setMinBet] = useState(10);
  const [maxBet, setMaxBet] = useState(1000);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [loading, setLoading] = useState(false);

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
    if (validatePassword(password)) {
      setLoading(true);

      try {
        let body: Room = {
          name,
          isPublic,
          minBet,
          maxBet,
          maxPlayers,
        };
        if (!isPublic) {
          body = { ...body, password };
        }
        await roomsAPI.create(body);

        toast.success("Room created!");
        onSuccess();
      } catch (error: any) {
        console.error("Error creating room:", error);
        toast.error(error.response?.data?.error || "Failed to create room");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-6">Create New Room</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="My Blackjack Table"
            />
          </div>

          <div>
            <label className="flex items-center space-x-2 text-gray-300">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-5 h-5"
              />
              <span>Public Room</span>
            </label>
          </div>

          {!isPublic && (
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
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Min Bet
              </label>
              <input
                type="number"
                value={minBet}
                onChange={(e) => setMinBet(Number(e.target.value))}
                min="1"
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Bet
              </label>
              <input
                type="number"
                value={maxBet}
                onChange={(e) => setMaxBet(Number(e.target.value))}
                min={minBet}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Players
            </label>
            <input
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              min="2"
              max="7"
              required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
