// frontend/src/pages/GamePage.tsx
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { socketService } from "../services/socketService";
import Card from "../components/Card";
import BettingControls from "../components/BettingControls";
import GameControls from "../components/GameControls";

export default function GamePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    status,
    roundNumber,
    players,
    dealerHand,
    dealerValue,
    myHand,
    myBet,
    currentPlayerTurn,
  } = useGameStore();

  useEffect(() => {
    if (!roomId) {
      navigate("/lobby");
      return;
    }

    // El socket ya se conectó en el lobby
    // Solo necesitamos unirse a la sala
    // socketService.joinRoom(roomId);
    // 3. Unirse via WebSocket
    setupRoom();

    return () => {
      // No desconectar aquí, solo al salir del lobby
    };
  }, [roomId]);

  async function setupRoom() {
    roomId && (await socketService.joinRoom(roomId));
  }

  const isMyTurn = currentPlayerTurn === user?.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Room: {roomId?.slice(0, 8)}
            </h1>
            <p className="text-gray-300">Round: {roundNumber}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg">
              <p className="text-sm text-gray-400">Balance</p>
              <p className="text-xl font-bold text-green-400">
                ${user?.balance}
              </p>
            </div>
            <button
              onClick={() => {
                socketService.disconnect();
                navigate("/lobby");
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Leave Table
            </button>
          </div>
        </div>
      </div>

      {/* Mesa de juego */}
      <div className="max-w-7xl mx-auto">
        {/* Dealer */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Dealer</h2>
          <div className="flex space-x-2 mb-4">
            {dealerHand.map((card, i) => (
              <Card key={i} card={card} />
            ))}
          </div>
          {status === "DEALER_TURN" && (
            <p className="text-lg text-white">Value: {dealerValue}</p>
          )}
        </div>

        {/* Mi mano */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Your Hand</h2>
          <div className="flex space-x-2 mb-4">
            {myHand.map((card, i) => (
              <Card key={i} card={card} />
            ))}
          </div>
          {myHand.length > 0 && (
            <p className="text-lg text-white">
              Value: {myHand.reduce((sum, card) => sum + card.value, 0)}
            </p>
          )}
        </div>

        {/* Controles */}
        {status === "BETTING" && <BettingControls />}
        {status === "PLAYING" && isMyTurn && <GameControls />}

        {/* Status */}
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-white text-lg">
            {status === "WAITING" && "Waiting for players..."}
            {status === "BETTING" && "Place your bets!"}
            {status === "DEALING" && "Dealing cards..."}
            {status === "PLAYING" &&
              (isMyTurn ? "Your turn!" : "Waiting for others...")}
            {status === "DEALER_TURN" && "Dealer playing..."}
            {status === "FINISHED" && "Round finished!"}
          </p>
        </div>

        {/* Jugadores */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {players.map((player) => (
            <div key={player.userId} className="bg-gray-800 rounded-lg p-4">
              <p className="text-white font-semibold">{player.username}</p>
              <p className="text-gray-400">Bet: ${player.bet}</p>
              {player.isBlackjack && (
                <span className="text-yellow-400">BLACKJACK!</span>
              )}
              {player.isBusted && <span className="text-red-400">BUSTED</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
