// frontend/src/pages/GamePage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { socketService } from "../services/socketService";
import { roomsAPI } from "../services/api";
import Card from "../components/Card";
import BettingControls from "../components/BettingControls";
import toast from "react-hot-toast";
import GameControls from "../components/GameControls";

export default function GamePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [isCreator, setIsCreator] = useState(false);

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

    setupRoom();

    // Si volvemos al WAITING state, resetear bet e hand después de 2 segundos
    if (status === "WAITING" && (myHand.length > 0 || myBet > 0)) {
      const timer = setTimeout(() => {
        useGameStore.getState().setMyHand([]);
        useGameStore.getState().setMyBet(0);
        useGameStore.getState().setDealerHand([], 0);
      }, 1500);
      return () => clearTimeout(timer);
    }

    return () => {
      // No desconectar aquí, solo limpiar
    };
  }, [roomId, status]);

  async function setupRoom() {
    try {
      // 1. Cargar info de la sala
      const response = await roomsAPI.get(roomId!);
      setRoomInfo(response.room);
      setIsCreator(response.room.createdBy === user?.email);

      // 2. Asegurarse de que el socket esté conectado
      if (!socketService.isConnected()) {
        const token = useAuthStore.getState().token;
        if (token) {
          await socketService.connect(token);
        }
      }

      // 3. Unirse a la sala via socket (solo si no ya está unido)
      const currentRoomId = socketService["roomId"];
      if (currentRoomId !== roomId) {
        await socketService.joinRoom(roomId!);
      }
    } catch (error: any) {
      console.error("Error setting up room:", error);
      toast.error(error.message || "Failed to join room");
      navigate("/lobby");
    }
  }

  const handleStartGame = () => {
    if (!isCreator) {
      toast.error("Only room creator can start the game");
      return;
    }

    if (players.length < 2) {
      toast.error("Need at least 2 players to start");
      return;
    }

    socketService.startGame();
  };

  const isMyTurn = currentPlayerTurn === user?.id;
  const canStartGame = isCreator && status === "WAITING" && players.length >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {roomInfo?.name || "Game Room"}
            </h1>
            <p className="text-gray-300">
              Room ID: {roomId?.slice(0, 8)} | Round: {roundNumber}
            </p>
            <p className="text-sm text-gray-400">
              Players: {players.length}/{roomInfo?.maxPlayers || 5}
            </p>
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
                socketService.leaveRoom();
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
        {/* Start Game Button (solo para el creador cuando hay suficientes jugadores) */}
        {canStartGame && (
          <div className="rounded-lg p-6 mb-6 text-center">
            <p className="text-white text-lg mb-4">
              Ready to start? You have {players.length} players waiting!
            </p>
            <button
              onClick={handleStartGame}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xl"
            >
              🎮 START GAME
            </button>
          </div>
        )}

        {/* Dealer */}
        {(status === "DEALING" ||
          status === "PLAYING" ||
          status === "DEALER_TURN" ||
          status === "FINISHED") && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Dealer {status === "DEALER_TURN" && "🎲"}
            </h2>
            <div className="flex space-x-2 mb-4">
              {dealerHand.map((card, i) => (
                <Card
                  key={i}
                  card={card}
                  hidden={
                    status === "DEALING" || status === "PLAYING"
                      ? i === 1
                      : false
                  }
                />
              ))}
            </div>
            {(status === "DEALER_TURN" || status === "FINISHED") && (
              <p className="text-lg text-white">Value: {dealerValue}</p>
            )}
          </div>
        )}

        {/* Mi mano */}
        {myHand.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border-2 border-green-500">
            <h2 className="text-xl font-bold text-white mb-4">
              Your Hand {isMyTurn && "⭐ YOUR TURN"}
            </h2>
            <div className="flex space-x-2 mb-4">
              {myHand.map((card, i) => (
                <Card key={i} card={card} />
              ))}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-lg text-white">
                Value: {myHand.reduce((sum, card) => sum + card.value, 0)}
              </p>
              {myBet > 0 && (
                <p className="text-lg text-yellow-400">Bet: ${myBet}</p>
              )}
            </div>
          </div>
        )}

        {/* Controles */}
        {status === "BETTING" && <BettingControls />}
        <GameControls />

        {/* Status */}
        <div className="bg-gray-800 rounded-lg p-4 text-center mb-6">
          <p className="text-white text-lg font-semibold">
            {status === "WAITING" && "⏳ Waiting for players to join..."}
            {status === "BETTING" && "💰 Place your bets!"}
            {status === "DEALING" && "🎴 Dealing cards..."}
            {status === "PLAYING" &&
              (isMyTurn
                ? "🎯 Your turn! Hit or Stand?"
                : "⏳ Waiting for others...")}
            {status === "DEALER_TURN" && "🎭 Dealer is playing..."}
            {status === "FINISHED" &&
              "🎉 Round finished! Next round starting soon..."}
          </p>
        </div>

        {/* Jugadores */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {players.map((player) => (
            <div
              key={player.userId}
              className={`bg-gray-800 rounded-lg p-4 ${
                player.userId === currentPlayerTurn
                  ? "border-2 border-yellow-400"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-semibold truncate">
                  {player.username}
                </p>
                {player.userId === currentPlayerTurn && (
                  <span className="text-yellow-400">⭐</span>
                )}
              </div>

              {player.bet > 0 && (
                <p className="text-gray-400 text-sm">Bet: ${player.bet}</p>
              )}

              <p className="text-gray-400 text-sm">
                Balance: ${player.balance}
              </p>

              {player.hand && player.hand.length > 0 && (
                <div className="mt-2 flex space-x-1">
                  {player.hand.slice(0, 3).map((card, i) => (
                    <div
                      key={i}
                      className="w-8 h-12 bg-white rounded text-xs flex items-center justify-center"
                    >
                      {card.rank}
                    </div>
                  ))}
                  {player.hand.length > 3 && (
                    <div className="w-8 h-12 bg-gray-700 rounded text-xs flex items-center justify-center text-white">
                      +{player.hand.length - 3}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2">
                {player.isBlackjack && (
                  <span className="text-yellow-400 text-sm font-bold">
                    ⚡ BLACKJACK!
                  </span>
                )}
                {player.isBusted && (
                  <span className="text-red-400 text-sm font-bold">
                    💥 BUSTED
                  </span>
                )}
                {player.isStanding &&
                  !player.isBusted &&
                  !player.isBlackjack && (
                    <span className="text-blue-400 text-sm">✋ Standing</span>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
