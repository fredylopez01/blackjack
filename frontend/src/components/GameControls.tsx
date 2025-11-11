// frontend/src/components/GameControls.tsx
import { socketService } from "../services/socketService";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";

export default function GameControls() {
  const { status, currentPlayerTurn } = useGameStore();
  const { user } = useAuthStore();

  // Solo mostrar controles si es el turno del usuario Y el estado es PLAYING
  if (status !== "PLAYING" || currentPlayerTurn !== user?.id) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6 border-2 border-blue-500">
      <h3 className="text-xl font-bold text-white mb-4">Your Turn</h3>
      <div className="flex space-x-4">
        <button
          onClick={() => socketService.hit()}
          className="flex-1 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xl transition"
        >
          HIT
        </button>
        <button
          onClick={() => socketService.stand()}
          className="flex-1 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xl transition"
        >
          STAND
        </button>
      </div>
    </div>
  );
}
