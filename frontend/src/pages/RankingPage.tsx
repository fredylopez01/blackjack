import { useState, useEffect } from "react";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Target,
  Award,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { rankingAPI } from "../services/api";
import toast from "react-hot-toast";
import Navigation from "../components/Navigation";
import { AxiosError } from "axios";
import { PlayerStats } from "../interfaces/PlayerStats";

export default function RankingPage() {
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDegraded, setIsDegraded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const globalRes = await rankingAPI.getGlobal(30);
      setPlayers(globalRes.rankings || []);

      if (globalRes.mode === "degraded") {
        setIsDegraded(true);
        toast.loading("Modo degradado: datos del sistema de backup", {
          duration: 3000,
        });
      } else {
        setIsDegraded(false);
      }

      try {
        const myRes = await rankingAPI.getMyStats();
        setMyStats(myRes || null);
      } catch (error) {
        if (error instanceof AxiosError && error.status === 404) {
          setMyStats(null);
        }
      }
    } catch (error) {
      if (error instanceof AxiosError && error.status === 503) {
        toast.error("Servicio no disponible. Intenta más tarde.");
      } else {
        toast.error("Error cargando ranking");
      }
      console.error("Error loading ranking:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success("Ranking actualizado");
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="text-yellow-400" size={24} />;
    if (rank === 2) return <Trophy className="text-gray-300" size={22} />;
    if (rank === 3) return <Trophy className="text-orange-400" size={20} />;
    return <span className="text-gray-400 font-bold">{rank}</span>;
  };

  const getRowStyle = (rank: number) => {
    if (rank === 1)
      return "bg-gradient-to-r from-yellow-900/40 to-green-900/40 border-yellow-500/50";
    if (rank === 2)
      return "bg-gradient-to-r from-gray-700/40 to-green-900/40 border-gray-400/50";
    if (rank === 3)
      return "bg-gradient-to-r from-orange-900/40 to-green-900/40 border-orange-500/50";
    return "bg-gray-800/40 border-gray-700/30";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900">
      <Navigation />

      <div className="p-4 md:p-8 mt-16 md:mt-0">
        <div className="max-w-6xl mx-auto">
          {/* Degraded Mode Alert */}
          {isDegraded && (
            <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-start gap-3">
              <AlertTriangle
                className="text-yellow-400 flex-shrink-0 mt-0.5"
                size={20}
              />
              <div>
                <p className="font-semibold text-yellow-300">Modo Degradado</p>
                <p className="text-sm text-yellow-200 mt-1">
                  Rankings calculados desde game-engine. Algunos datos pueden
                  ser parciales.
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <Trophy size={32} className="text-green-400" />
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Ranking Global
              </h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
            >
              <RefreshCw
                size={18}
                className={refreshing ? "animate-spin" : ""}
              />
              Actualizar
            </button>
          </div>

          {/* Mi Ranking */}
          {myStats && (
            <div className="mb-8 bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6 text-white">
              <p className="text-sm text-green-100 mb-2">Tu Posición</p>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <p className="text-4xl font-bold mb-2">{myStats.rank}</p>
                  <p className="text-green-100">{myStats.username}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto mt-4 md:mt-0">
                  <div className="bg-white/10 p-3 rounded-lg">
                    <p className="text-xs text-green-100">Partidas</p>
                    <p className="text-2xl font-bold">{myStats.totalGames}</p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-lg">
                    <p className="text-xs text-green-100">Ganadas</p>
                    <p className="text-2xl font-bold">{myStats.gamesWon}</p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-lg">
                    <p className="text-xs text-green-100">Win Rate</p>
                    <p className="text-2xl font-bold">
                      {Math.round(myStats.winRate)}%
                    </p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-lg">
                    <p className="text-xs text-green-100">Ganancia</p>
                    <p
                      className={`flex items-center gap-2 text-2xl font-bold ${
                        myStats.totalProfit >= 0
                          ? "text-green-300"
                          : "text-red-300"
                      }`}
                    >
                      {myStats.totalProfit >= 0 ? (
                        <TrendingUp size={12} />
                      ) : (
                        <TrendingDown size={12} />
                      )}
                      ${Math.abs(myStats.totalProfit)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ranking Table */}
          {loading ? (
            <div className="text-center text-gray-300 py-12">
              <div className="inline-block animate-spin">
                <RefreshCw size={32} />
              </div>
              <p className="mt-4">Cargando ranking...</p>
            </div>
          ) : players.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <Trophy size={48} className="mx-auto mb-4 opacity-50" />
              <p>No hay datos de ranking aún</p>
            </div>
          ) : (
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-green-500/20 overflow-hidden">
              {/* Table Header - Hidden on mobile */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 bg-gray-900/50 px-6 py-4 border-b border-green-500/20 text-gray-300 font-semibold text-sm">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-3">Jugador</div>
                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                  <Target size={14} />
                  Partidas
                </div>
                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                  <Award size={14} />V / D
                </div>
                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                  <Zap size={14} />
                  Win Rate
                </div>
                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                  <TrendingUp size={14} />
                  Ganancia
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-700/30">
                {players.map((player) => {
                  const rowStyle = getRowStyle(player.rank);
                  return (
                    <div
                      key={player.userId}
                      className={`${rowStyle} border-l-4 hover:bg-green-900/20 transition-all duration-200`}
                    >
                      {/* Desktop Layout */}
                      <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 items-center">
                        <div className="col-span-1 flex justify-center">
                          <div className="w-10 h-10 bg-gray-900/50 rounded-lg flex items-center justify-center">
                            {getRankIcon(player.rank)}
                          </div>
                        </div>

                        <div className="col-span-3">
                          <p className="font-bold text-white truncate">
                            {player.username}
                          </p>
                        </div>

                        <div className="col-span-2 text-center">
                          <p className="text-white font-semibold text-lg">
                            {player.totalGames}
                          </p>
                        </div>

                        <div className="col-span-2 text-center">
                          <p className="text-white font-semibold text-lg">
                            <span className="text-green-400">
                              {player.gamesWon}
                            </span>
                            {" / "}
                            <span className="text-red-400">
                              {player.gamesLost}
                            </span>
                          </p>
                        </div>

                        <div className="col-span-2 text-center">
                          <div className="inline-flex items-center gap-2 bg-gray-900/50 px-3 py-1 rounded-lg">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                player.winRate >= 60
                                  ? "bg-green-400"
                                  : player.winRate >= 40
                                  ? "bg-yellow-400"
                                  : "bg-red-400"
                              }`}
                            ></div>
                            <span className="text-white font-bold">
                              {Math.round(player.winRate)}%
                            </span>
                          </div>
                        </div>

                        <div className="col-span-2 text-center">
                          <div
                            className={`inline-flex items-center gap-1 font-bold text-lg ${
                              player.totalProfit >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {player.totalProfit >= 0 ? (
                              <TrendingUp size={18} />
                            ) : (
                              <TrendingDown size={18} />
                            )}
                            ${Math.abs(player.totalProfit)}
                          </div>
                        </div>
                      </div>

                      {/* Mobile Layout */}
                      <div className="md:hidden p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 bg-gray-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                            {getRankIcon(player.rank)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">
                              {player.username}
                            </p>
                            <p className="text-sm text-gray-400">
                              {player.totalGames} partidas jugadas
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-400 mb-1">V / D</p>
                            <p className="text-sm font-semibold">
                              <span className="text-green-400">
                                {player.gamesWon}
                              </span>
                              {" / "}
                              <span className="text-red-400">
                                {player.gamesLost}
                              </span>
                            </p>
                          </div>

                          <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-400 mb-1">
                              Win Rate
                            </p>
                            <div className="flex items-center justify-center gap-1">
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${
                                  player.winRate >= 60
                                    ? "bg-green-400"
                                    : player.winRate >= 40
                                    ? "bg-yellow-400"
                                    : "bg-red-400"
                                }`}
                              ></div>
                              <span className="text-sm text-white font-bold">
                                {Math.round(player.winRate)}%
                              </span>
                            </div>
                          </div>

                          <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-400 mb-1">
                              Ganancia
                            </p>
                            <p
                              className={`text-sm font-bold flex items-center justify-center gap-0.5 ${
                                player.totalProfit >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {player.totalProfit >= 0 ? (
                                <TrendingUp size={12} />
                              ) : (
                                <TrendingDown size={12} />
                              )}
                              ${Math.abs(player.totalProfit)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
