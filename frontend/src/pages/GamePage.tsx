// frontend/src/pages/GamePage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { socketService } from "../services/socketService";
import { roomsAPI } from "../services/api";
import Card from "../components/Card";
import BettingControls from "../components/BettingControls";
import toast from "react-hot-toast";
import GameControls from "../components/GameControls";
import {
  Bomb,
  Dices,
  Hand,
  Hourglass,
  Joystick,
  Star,
  UserStar,
  Zap,
} from "lucide-react";

export default function GamePage() {
  const location = useLocation();
  const password = (location.state as { password?: string })?.password;
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
      const response = await roomsAPI.join(roomId!, password);
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
      if (error.response?.status === 403) {
        toast.error(error.response.data.message || "Invalid room password");
      } else {
        console.error("Error setting up room:", error);
        toast.error(error.message || "Failed to join room");
      }
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
    <div className="min-h-dvh bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 p-3 md:p-6 flex flex-col">
      {/* Top Bar */}
      <div className="sticky md:top-0 z-10 bg-gradient-to-r from-gray-900/95 to-green-900/95 backdrop-blur-sm p-3 md:p-4 rounded-lg mb-4 border border-green-500/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-2xl font-bold text-white mb-1">
              {roomInfo?.name || "Game Room"}
            </h1>
            <div className="flex flex-wrap gap-3 text-xs md:text-sm text-gray-300">
              <span className="bg-gray-800/50 px-2 py-1 rounded">
                ID Sala: {roomId?.slice(0, 8)}
              </span>
              <span className="bg-gray-800/50 px-2 py-1 rounded">
                Ronda {roundNumber}
              </span>
              <span className="bg-green-600/30 px-2 py-1 rounded text-green-300">
                {players.length}/{roomInfo?.maxPlayers || 5} Jugadores
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex-1 md:flex-none flex items-center gap-2 bg-green-500/20 border border-green-500/50 px-3 md:px-4 py-2 rounded-lg">
              <p className="text-xs md:text-sm text-gray-400">Balance</p>
              <p className="text-lg md:text-xl font-bold text-green-400">
                ${user?.balance}
              </p>
            </div>
            <button
              onClick={() => {
                socketService.leaveRoom();
                navigate("/lobby");
              }}
              className="px-3 md:px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm md:text-base rounded-lg transition duration-200"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full">
        {/* Start Game Button */}
        {canStartGame && (
          <div className="bg-gradient-to-r from-green-600/20 to-green-500/10 border-2 border-green-500/60 rounded-lg p-4 md:p-6 mb-4 md:mb-6 text-center animate-pulse">
            <p className="text-white text-sm md:text-base mb-3 font-semibold">
              Ready to start? You have {players.length} players waiting!
            </p>
            <button
              onClick={handleStartGame}
              className="inline-flex items-center gap-2 px-6 md:px-8 py-2 md:py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm md:text-base transition duration-200 shadow-lg hover:shadow-green-500/50"
            >
              <Joystick size={18} /> START GAME
            </button>
          </div>
        )}

        {/* Game Table */}
        <div className="space-y-3 md:space-y-4">
          {/* Dealer Section */}
          {(status === "DEALING" ||
            status === "PLAYING" ||
            status === "DEALER_TURN" ||
            status === "FINISHED") && (
            <div
              className={`bg-gradient-to-br from-gray-800/70 to-gray-900/70 rounded-lg p-4 md:p-6 border-2 transition ${
                status === "DEALER_TURN"
                  ? "border-yellow-500 shadow-lg shadow-yellow-500/30"
                  : "border-gray-600/50"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-bold text-white">
                  Repartidor
                </h2>
                {status === "DEALER_TURN" && (
                  <div className="flex items-center gap-2 text-yellow-400 font-semibold text-sm animate-pulse">
                    <Dices size={20} /> Playing
                  </div>
                )}
              </div>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
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
                <div className="flex items-center justify-between">
                  <p className="text-base md:text-lg text-gray-300">Value:</p>
                  <p className="text-xl md:text-2xl font-bold text-green-400">
                    {dealerValue}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* My Hand Section */}
          {myHand.length > 0 && (
            <div
              className={`bg-gradient-to-br from-green-900/40 to-gray-900/70 rounded-lg p-4 md:p-6 border-2 transition shadow-lg ${
                isMyTurn
                  ? "border-green-400 shadow-green-500/40"
                  : "border-green-500/40"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-bold text-white">
                  Tu Mano
                </h2>
                {isMyTurn && (
                  <div className="flex items-center gap-2 text-yellow-400 text-sm font-bold animate-pulse">
                    <UserStar size={18} />
                    <span>TU TURNO</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {myHand.map((card, i) => (
                  <div
                    key={i}
                    className="transform hover:scale-110 transition duration-200"
                  >
                    <Card card={card} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 bg-gray-800/40 rounded p-3">
                <div>
                  <p className="text-xs md:text-sm text-gray-400 mb-1">
                    Valor Mano
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-green-400">
                    {myHand.reduce((sum, card) => sum + card.value, 0)}
                  </p>
                </div>
                {myBet > 0 && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-400 mb-1">
                      Tu Apuesta
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-yellow-400">
                      ${myBet}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Betting/Game Controls */}
          {status === "BETTING" && <BettingControls />}
          <GameControls />

          {/* Status */}
          <div
            className={`rounded-lg p-4 md:p-5 border-2 text-center transition ${
              status === "FINISHED"
                ? "bg-green-600/30 border-green-500/60"
                : status === "PLAYING"
                ? "bg-blue-600/30 border-blue-500/60"
                : "bg-gray-800/60 border-gray-600/50"
            }`}
          >
            <p className="flex items-center justify-center gap-2 text-white text-sm md:text-base font-semibold">
              {status === "WAITING" && (
                <>
                  <Hourglass size={16} /> Esperando otros jugadores...
                </>
              )}
              {status === "BETTING" && "Haz tus apuestas!"}
              {status === "DEALING" && "Repartiendo cartas..."}
              {status === "PLAYING" &&
                (isMyTurn
                  ? "Tu turno! Pedir carta o plantarse?"
                  : "Esperando otras jugadas...")}
              {status === "DEALER_TURN" && "Repartidor está jugando..."}
              {status === "FINISHED" &&
                "Ronda terminada! Siguiente ronda iniciará..."}
            </p>
          </div>
        </div>

        {/* Players Grid */}
        <div className="mt-6 md:mt-8">
          <h3 className="text-sm md:text-base font-bold text-gray-300 mb-3 uppercase tracking-wider">
            Tabla Jugadores
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
            {players.map((player) => (
              <div
                key={player.userId}
                className={`bg-gradient-to-br rounded-lg p-3 md:p-4 border-2 transition duration-300 transform hover:scale-105 ${
                  player.userId === currentPlayerTurn
                    ? "from-yellow-600/40 to-gray-800/70 border-yellow-400 shadow-lg shadow-yellow-500/40"
                    : "from-gray-800/50 to-gray-900/50 border-gray-600/30 hover:border-gray-500/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="text-xs md:text-sm text-white font-bold truncate flex-1">
                    {player.username}
                  </p>
                  {player.userId === currentPlayerTurn && (
                    <div className="flex items-center gap-1 text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded text-xs font-bold">
                      <Star size={12} /> TURNO
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-3 pb-3 border-b border-gray-600/30">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-400">Balance</p>
                    <p className="text-sm font-semibold text-green-400">
                      ${player.balance}
                    </p>
                  </div>
                  {player.bet > 0 && (
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-400">Bet</p>
                      <p className="text-sm font-bold text-yellow-400">
                        ${player.bet}
                      </p>
                    </div>
                  )}
                </div>

                {player.hand && player.hand.length > 0 && (
                  <div className="flex gap-1 mb-3">
                    {player.hand.slice(0, 3).map((card, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-white rounded text-xs md:text-xs flex items-center justify-center font-bold text-gray-900 py-1.5"
                      >
                        {card.rank[0]}
                      </div>
                    ))}
                    {player.hand.length > 3 && (
                      <div className="w-6 h-6 md:w-7 md:h-7 bg-gray-600 rounded text-xs flex items-center justify-center text-white font-bold">
                        +{player.hand.length - 3}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  {player.isBlackjack && (
                    <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold bg-yellow-500/20 px-2 py-1 rounded">
                      <Zap size={12} /> BLACKJACK
                    </div>
                  )}
                  {player.isBusted && (
                    <div className="flex items-center gap-1 text-red-400 text-xs font-bold bg-red-500/20 px-2 py-1 rounded">
                      <Bomb size={12} /> PASADO
                    </div>
                  )}
                  {player.isStanding &&
                    !player.isBusted &&
                    !player.isBlackjack && (
                      <div className="flex items-center gap-1 text-blue-400 text-xs font-semibold bg-blue-500/20 px-2 py-1 rounded">
                        <Hand size={12} /> Plantado
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
