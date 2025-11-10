// frontend/src/components/GameControls.tsx
import { socketService } from "../services/socketService";

export default function GameControls() {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-xl font-bold text-white mb-4">Your Turn</h3>
      <div className="flex space-x-4">
        <button
          onClick={() => socketService.hit()}
          className="flex-1 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xl"
        >
          HIT
        </button>
        <button
          onClick={() => socketService.stand()}
          className="flex-1 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xl"
        >
          STAND
        </button>
      </div>
    </div>
  );
}
