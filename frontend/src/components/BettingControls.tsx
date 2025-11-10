// frontend/src/components/BettingControls.tsx
import { useGameStore } from "../store/gameStore";
import { socketService } from "../services/socketService";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";
import { useState } from "react";

export default function BettingControls() {
  const { minBet, maxBet, myBet } = useGameStore();
  const { user } = useAuthStore();
  const [betAmount, setBetAmount] = useState(minBet);

  const handlePlaceBet = () => {
    if (myBet > 0) {
      toast.error("You already placed a bet!");
      return;
    }

    if (betAmount < minBet || betAmount > maxBet) {
      toast.error(`Bet must be between $${minBet} and $${maxBet}`);
      return;
    }

    if (betAmount > (user?.balance || 0)) {
      toast.error("Insufficient balance!");
      return;
    }

    socketService.placeBet(betAmount);
  };

  const quickBets = [minBet, minBet * 2, minBet * 5, minBet * 10].filter(
    (amount) => amount <= maxBet && amount <= (user?.balance || 0)
  );

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6 border-2 border-yellow-500">
      <h3 className="text-xl font-bold text-white mb-4">💰 Place Your Bet</h3>

      {myBet > 0 ? (
        <div className="text-center">
          <p className="text-2xl text-green-400 font-bold mb-2">
            Bet Placed: ${myBet}
          </p>
          <p className="text-gray-400">Waiting for other players...</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount ($)
            </label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) =>
                setBetAmount(Math.max(minBet, Number(e.target.value)))
              }
              min={minBet}
              max={maxBet}
              className="w-full px-4 py-3 bg-gray-700 text-white text-xl font-bold rounded-lg border-2 border-gray-600 focus:border-green-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {quickBets.map((amount) => (
              <button
                key={amount}
                onClick={() => setBetAmount(amount)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition"
              >
                ${amount}
              </button>
            ))}
          </div>

          <button
            onClick={handlePlaceBet}
            disabled={betAmount < minBet || betAmount > maxBet}
            className="w-full px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xl transition"
          >
            Bet ${betAmount}
          </button>

          <div className="mt-3 flex justify-between text-sm text-gray-400">
            <span>Min: ${minBet}</span>
            <span>Max: ${maxBet}</span>
            <span>Balance: ${user?.balance}</span>
          </div>
        </>
      )}
    </div>
  );
}
