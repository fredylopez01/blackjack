import { useState, useEffect } from "react";
import {
  History,
  RefreshCw,
  Gamepad2,
  Trophy,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { historyAPI } from "../services/api";
import toast from "react-hot-toast";
import Navigation from "../components/Navigation";
import { useAuthStore } from "../store/authStore";
import { GameHistoryRecord, GameResult } from "../interfaces/History";

export default function HistoryPage() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<GameHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await historyAPI
        .getMyHistory(30)
        .catch(() => ({ history: [] }));
      setHistory(data.data.history || []);
    } catch (error) {
      console.error("Error loading history:", error);
      toast.error("Error cargando historial");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
    toast.success("Historial actualizado");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateTotalProfit = (results: GameResult[]) => {
    return results.reduce((acc, r) => acc + r.profit, 0);
  };

  const getGameResultColor = (profit: number) => {
    if (profit > 0)
      return "border-green-500/50 bg-gradient-to-r from-green-900/70 to-gray-800/70";
    if (profit < 0)
      return "border-red-500/50 bg-gradient-to-r from-red-900/70 to-gray-800/70";
    return "border-gray-600/50 bg-gradient-to-r from-gray-800/70 to-gray-800/70";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900">
      <Navigation />

      <div className="p-4 md:p-8 mt-16 md:mt-0">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/20 p-3 rounded-lg">
                <History size={28} className="text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Historial de Partidas
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Tus últimas {history.length} partidas
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 shadow-lg"
            >
              <RefreshCw
                size={18}
                className={refreshing ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>

          {/* History List */}
          {loading ? (
            <div className="text-center text-gray-300 py-12">
              <div className="inline-block animate-spin">
                <RefreshCw size={32} className="text-green-400" />
              </div>
              <p className="mt-4 text-gray-400">Cargando historial...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 border border-gray-700/50">
                <Gamepad2
                  size={64}
                  className="mx-auto mb-4 opacity-50 text-green-400"
                />
                <p className="text-lg font-semibold text-gray-300">
                  No hay partidas registradas aún
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Juega tu primera partida para ver tu historial
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((game) => {
                const totalProfit = calculateTotalProfit(game.results);
                const myResult = game.results.filter(
                  (r) => r.username === user?.email
                )[0]; // Primera es la del usuario
                const isExpanded = expandedGame === game.id;
                const gameColor = getGameResultColor(myResult.profit);

                return (
                  <div
                    key={game.id}
                    className={`${gameColor} border-l-4 rounded-lg overflow-hidden backdrop-blur-sm transition-all duration-200 hover:shadow-lg`}
                  >
                    {/* Game Header */}
                    <button
                      onClick={() =>
                        setExpandedGame(isExpanded ? null : game.id)
                      }
                      className="w-full p-4 md:p-5 transition-colors hover:bg-gray-800/40"
                    >
                      {/* Desktop Layout */}
                      <div className="hidden md:flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          {/* Icon & Date */}
                          <div className="bg-gray-900/50 p-3 rounded-lg">
                            <Gamepad2 className="text-green-400" size={24} />
                          </div>

                          {/* Game Info */}
                          <div className="text-left">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock size={14} className="text-gray-400" />
                              <span className="text-sm text-gray-300 font-medium">
                                {formatDate(game.startedAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-md font-semibold flex items-center gap-1">
                                <Target size={12} />
                                {game.totalRounds} rondas
                              </span>
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md font-semibold flex items-center gap-1">
                                <Users size={12} />
                                {game.playersCount} jugadores
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-gray-400 mb-1">
                              Ganadas
                            </p>
                            <p className="text-xl font-bold text-green-400">
                              {myResult.roundsWon}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-400 mb-1">
                              Perdidas
                            </p>
                            <p className="text-xl font-bold text-red-400">
                              {myResult.roundsLost}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-400 mb-1">
                              Empates
                            </p>
                            <p className="text-xl font-bold text-gray-400">
                              {myResult.roundsPush}
                            </p>
                          </div>

                          {/* Profit */}
                          <div className="bg-gray-900/50 px-4 py-3 rounded-lg min-w-[120px]">
                            <p className="text-xs text-gray-400 mb-1">
                              Balance
                            </p>
                            <div
                              className={`text-2xl font-bold flex items-center justify-center gap-1 ${
                                myResult.profit >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {myResult.profit >= 0 ? (
                                <TrendingUp size={20} />
                              ) : (
                                <TrendingDown size={20} />
                              )}
                              ${Math.abs(myResult.profit)}
                            </div>
                          </div>

                          {/* Expand Icon */}
                          <div className="text-gray-400">
                            {isExpanded ? (
                              <ChevronDown size={24} />
                            ) : (
                              <ChevronRight size={24} />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mobile Layout */}
                      <div className="md:hidden">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-gray-900/50 p-2 rounded-lg">
                              <Gamepad2 className="text-green-400" size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Clock size={12} className="text-gray-400" />
                                <span className="text-xs text-gray-300 font-medium">
                                  {formatDate(game.startedAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-md font-semibold">
                                  {game.totalRounds} rondas
                                </span>
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md font-semibold">
                                  {game.playersCount} jugadores
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Profit Mobile */}
                          <div
                            className={`text-right ${
                              myResult.profit >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            <div className="flex items-center gap-1 text-xl font-bold">
                              {myResult.profit >= 0 ? (
                                <TrendingUp size={18} />
                              ) : (
                                <TrendingDown size={18} />
                              )}
                              ${Math.abs(myResult.profit)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex gap-4">
                            <div className="text-center">
                              <p className="text-xs text-gray-400">W</p>
                              <p className="text-lg font-bold text-green-400">
                                {myResult.roundsWon}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-400">L</p>
                              <p className="text-lg font-bold text-red-400">
                                {myResult.roundsLost}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-400">P</p>
                              <p className="text-lg font-bold text-gray-400">
                                {myResult.roundsPush}
                              </p>
                            </div>
                          </div>

                          <div className="text-gray-400">
                            {isExpanded ? (
                              <ChevronDown size={20} />
                            ) : (
                              <ChevronRight size={20} />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Game Details - Expanded */}
                    {isExpanded && (
                      <div className="border-t border-gray-700/50 bg-gray-900/40 p-4 md:p-6">
                        {/* Players Results */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-4">
                            <Trophy className="text-green-400" size={18} />
                            <h4 className="text-sm font-bold text-gray-200">
                              Resultados de Jugadores
                            </h4>
                          </div>
                          <div className="space-y-2">
                            {game.results.map((result, idx) => (
                              <div
                                key={idx}
                                className="bg-gray-800/50 backdrop-blur-sm p-3 md:p-4 rounded-lg border border-gray-700/30 hover:border-green-500/30 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div
                                        className={`w-2 h-2 rounded-full ${
                                          result.username === user?.email
                                            ? "bg-green-400"
                                            : "bg-gray-500"
                                        }`}
                                      ></div>
                                      <p className="text-sm font-semibold text-white truncate">
                                        {result.username}
                                        {result.username === user?.email && (
                                          <span className="ml-2 text-xs text-green-400">
                                            (Tú)
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-400 ml-4">
                                      <span className="text-green-400 font-semibold">
                                        {result.roundsWon}W
                                      </span>
                                      <span className="text-red-400 font-semibold">
                                        {result.roundsLost}L
                                      </span>
                                      <span className="text-gray-400 font-semibold">
                                        {result.roundsPush}P
                                      </span>
                                      <span className="text-gray-500">•</span>
                                      <span>
                                        Balance: ${result.finalBalance}
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    className={`text-right ml-4 ${
                                      result.profit >= 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1 font-bold text-lg">
                                      {result.profit >= 0 ? (
                                        <TrendingUp size={16} />
                                      ) : (
                                        <TrendingDown size={16} />
                                      )}
                                      ${Math.abs(result.profit)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 p-4 rounded-lg border border-gray-700/30">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 font-semibold flex items-center gap-2">
                              <Target size={16} className="text-green-400" />
                              Total de la partida:
                            </span>
                            <span
                              className={`text-xl font-bold flex items-center gap-1 ${
                                totalProfit >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {totalProfit >= 0 ? (
                                <TrendingUp size={20} />
                              ) : (
                                <TrendingDown size={20} />
                              )}
                              ${Math.abs(totalProfit)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
