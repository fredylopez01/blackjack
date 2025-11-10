// frontend/src/components/BettingControls.tsx

import { useGameStore } from "../store/gameStore";
import { socketService } from "../services/socketService";
import toast from "react-hot-toast";
import { useState } from "react";
import { Input } from "postcss";

export default function BettingControls() {
  const { minBet, maxBet } = useGameStore();
  const [betAmount, setBetAmount] = useState(minBet);

  const handlePlaceBet = () => {
    if (betAmount < minBet || betAmount > maxBet) {
      toast.error(`Bet must be between $${minBet} and $${maxBet}`);
      return;
    }
    socketService.placeBet(betAmount);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-xl font-bold text-white mb-4">Place Your Bet</h3>
      <div className="flex items-center space-x-4">
        <Input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(Number(e.target.value))}
          min={minBet}
          max={maxBet}
          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg"
        />
        <button
          onClick={handlePlaceBet}
          className="px-8 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg"
        >
          Bet ${betAmount}
        </button>
      </div>
      <p className="text-gray-400 text-sm mt-2">
        Min: ${minBet} | Max: ${maxBet}
      </p>
    </div>
  );
}
