import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  TriangleAlert,
  LogIn,
  TrendingUp,
  Award,
  Flame,
  Target,
  Clock,
  Crown,
} from "lucide-react";
import { authAPI, rankingAPI } from "../services/api";
import toast from "react-hot-toast";
import Navigation from "../components/Navigation";
import { PlayerStats } from "@/interfaces/PlayerStats";
import { AxiosError } from "axios";
import { UserProfile } from "../interfaces/User";
import { openCheckout } from "../services/epayco";
import { openMockCheckout } from "../services/paymentMock";

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const usdRate = Number(import.meta.env.VITE_USD_RATE || "4000");
  const usdAmount = topUpAmount
    ? (Number(topUpAmount) / (usdRate || 1)).toFixed(2)
    : "0.00";

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await authAPI.getProfile();
      setUser(profile.data.user);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Error cargando perfil");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const myRes = await rankingAPI.getMyStats();
      setStats(myRes || null);
    } catch (error) {
      if (error instanceof AxiosError && error.status === 404) {
        setStats(null);
      } else {
        toast.error("Error cargando ranking");
      }
      console.error("Error loading ranking:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadStats();
  }, [loadProfile, loadStats]);

  useEffect(() => {
    const state = location.state as { refreshProfile?: boolean } | null;
    if (state?.refreshProfile) {
      loadProfile();
      loadStats();
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, loadProfile, loadStats, navigate]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      setIsChangingPassword(true);
      const myRes = await authAPI.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      toast.success(myRes.message || "Contraseña actualizada");
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Error cambiando contraseña");
    } finally {
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsChangingPassword(false);
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cop = Number(topUpAmount);
    if (Number.isNaN(cop) || cop <= 0) {
      toast.error("Ingresa un monto valido en COP");
      return;
    }

    try {
      setIsProcessingTopUp(true);
      if (!user?.id) {
        toast.error("Usuario no identificado");
        return;
      }
      
      // Usar mock en desarrollo, ePayco en producción
      const useMock = (import.meta as any).env.MODE === "development";
      
      if (useMock) {
        await openMockCheckout({
          copAmount: cop,
          description: "Recarga de balance Blackjack",
          userId: user.id,
        });
      } else {
        await openCheckout({
          copAmount: cop,
          description: "Recarga de balance Blackjack",
          userId: user.id,
        });
      }
      setTopUpAmount("");
    } catch (error) {
      console.error("Error iniciando pago:", error);
      toast.error("No se pudo iniciar el pago");
    } finally {
      setIsProcessingTopUp(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900">
      <Navigation />

      <div className="p-4 md:p-8 mt-16 md:mt-0">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <User size={32} className="text-green-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Mi Perfil
            </h1>
          </div>

          {loading ? (
            <div className="text-center text-gray-300 py-12 mt-16 md:mt-0">
              <div className="inline-block animate-spin">
                <RefreshCw size={32} className="text-gray-300" />
              </div>
              <p className="mt-4 text-gray-300">Cargando perfil...</p>
            </div>
          ) : (
            <>
              {/* Profile Card */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg py-6 px-3 md:p-8 mb-8 text-white">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                      <User size={30} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold">{user?.email}</h2>
                      <p className="text-sm text-green-100">Jugador Activo</p>
                    </div>
                  </div>
                  <div className="w-full bg-white/10 px-6 py-4 rounded-lg">
                    <p className=" text-green-100 text-sm">Balance</p>
                    <p className="text-3xl font-bold">${user?.balance || 0}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stats Section */}
                {stats ? (
                  <>
                    {/* Main Stats Grid */}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Partidas Totales */}
                      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 text-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-blue-100">Partidas Totales</span>
                          <Target size={20} className="text-blue-200" />
                        </div>
                        <p className="text-3xl font-bold">{stats.totalGames}</p>
                        <p className="text-xs text-blue-100 mt-1">Experiencia acumulada</p>
                      </div>

                      {/* Partidas Ganadas */}
                      <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4 text-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-green-100">Victorias</span>
                          <Award size={20} className="text-green-200" />
                        </div>
                        <p className="text-3xl font-bold">{stats.gamesWon}</p>
                        <p className="text-xs text-green-100 mt-1">Partidas ganadas</p>
                      </div>

                      {/* Partidas Perdidas */}
                      <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-4 text-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-red-100">Derrotas</span>
                          <Flame size={20} className="text-red-200" />
                        </div>
                        <p className="text-3xl font-bold">{stats.gamesLost}</p>
                        <p className="text-xs text-red-100 mt-1">Partidas perdidas</p>
                      </div>

                      {/* Ganancia Total */}
                      <div className={`bg-gradient-to-br ${stats.totalProfit >= 0 ? 'from-emerald-600 to-emerald-700' : 'from-orange-600 to-orange-700'} rounded-lg p-4 text-white`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-white/90">Ganancia Total</span>
                          <TrendingUp size={20} className="text-white/80" />
                        </div>
                        <p className="text-3xl font-bold">${stats.totalProfit}</p>
                        <p className="text-xs text-white/70 mt-1">Balance neto</p>
                      </div>
                    </div>

                    {/* Detailed Stats */}
                    <div className="md:col-span-2 bg-gray-800 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Crown size={24} className="text-yellow-400" />
                        Análisis Detallado
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Win Rate */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">Tasa de Victoria</span>
                            <span className="text-2xl font-bold text-blue-400">
                              {Math.round(stats.winRate)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-500"
                              style={{ width: `${Math.min(stats.winRate, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            {stats.gamesWon} de {stats.totalGames} partidas ganadas
                          </p>
                        </div>

                        {/* Promedio Ganancia por Partida */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">Promedio por Partida</span>
                            <span className={`text-2xl font-bold ${
                              (stats.totalProfit / stats.totalGames) >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}>
                              ${Math.round(stats.totalProfit / stats.totalGames)}
                            </span>
                          </div>
                          <div className="bg-gray-700 rounded-lg p-3">
                            <p className="text-xs text-gray-400">
                              Ganancia promedio por cada partida jugada
                            </p>
                          </div>
                        </div>

                        {/* Racha Actual */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300 flex items-center gap-2">
                              <Flame size={16} className="text-orange-400" />
                              Racha Actual
                            </span>
                            <span className="text-2xl font-bold text-orange-400">
                              {stats.totalGames > 0 ? Math.max(0, stats.gamesWon - stats.gamesLost) : 0}
                            </span>
                          </div>
                          <div className="bg-gray-700 rounded-lg p-3">
                            <p className="text-xs text-gray-400">
                              Diferencia entre victorias y derrotas
                            </p>
                          </div>
                        </div>

                        {/* ROI */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">Retorno de Inversión</span>
                            <span className={`text-2xl font-bold ${
                              (stats.totalProfit / Math.max(1, stats.totalGames * 1000)) >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}>
                              {((stats.totalProfit / Math.max(1, stats.totalGames * 1000)) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="bg-gray-700 rounded-lg p-3">
                            <p className="text-xs text-gray-400">
                              Rendimiento relativo de inversión
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Achievement Badges */}
                    <div className="md:col-span-2 bg-gray-800 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Award size={24} className="text-yellow-400" />
                        Logros
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Logro: Primeras Partidas */}
                        <div className={`p-4 rounded-lg text-center ${stats.totalGames >= 1 ? 'bg-green-900/30 border border-green-500' : 'bg-gray-700/30 border border-gray-600'}`}>
                          <p className="text-2xl mb-2">🎮</p>
                          <p className="text-xs font-semibold text-gray-300">Primer Paso</p>
                          <p className="text-xs text-gray-400 mt-1">{stats.totalGames >= 1 ? '✓ Desbloqueado' : 'Juega 1 partida'}</p>
                        </div>

                        {/* Logro: 10 Partidas */}
                        <div className={`p-4 rounded-lg text-center ${stats.totalGames >= 10 ? 'bg-green-900/30 border border-green-500' : 'bg-gray-700/30 border border-gray-600'}`}>
                          <p className="text-2xl mb-2">⚡</p>
                          <p className="text-xs font-semibold text-gray-300">Experiencia</p>
                          <p className="text-xs text-gray-400 mt-1">{stats.totalGames >= 10 ? '✓ Desbloqueado' : `${stats.totalGames}/10`}</p>
                        </div>

                        {/* Logro: 50% Win Rate */}
                        <div className={`p-4 rounded-lg text-center ${stats.winRate >= 50 ? 'bg-green-900/30 border border-green-500' : 'bg-gray-700/30 border border-gray-600'}`}>
                          <p className="text-2xl mb-2">🎯</p>
                          <p className="text-xs font-semibold text-gray-300">Experto</p>
                          <p className="text-xs text-gray-400 mt-1">{stats.winRate >= 50 ? '✓ Desbloqueado' : `${Math.round(stats.winRate)}%`}</p>
                        </div>

                        {/* Logro: Ganancia Positiva */}
                        <div className={`p-4 rounded-lg text-center ${stats.totalProfit > 0 ? 'bg-green-900/30 border border-green-500' : 'bg-gray-700/30 border border-gray-600'}`}>
                          <p className="text-2xl mb-2">💰</p>
                          <p className="text-xs font-semibold text-gray-300">Rentable</p>
                          <p className="text-xs text-gray-400 mt-1">{stats.totalProfit > 0 ? '✓ Desbloqueado' : 'Gana dinero'}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 bg-gray-800 rounded-lg p-6 flex flex-col items-center justify-center">
                    <h3 className="flex flex-col items-center gap-2 text-xl font-bold text-orange-400 mb-4 text-center">
                      <TriangleAlert /> Necesitas jugar para ver tus
                      estadísticas
                    </h3>
                  </div>
                )}

                {/* Account Info Section */}
                <div className="md:col-span-2 bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Clock size={24} className="text-cyan-400" />
                    Información de Cuenta
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg">
                      <Mail size={20} className="text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">Email</p>
                        <p className="text-sm font-semibold text-white truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg">
                      <Zap size={20} className="text-green-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-400">Balance Actual</p>
                        <p className="text-sm font-semibold text-green-400">
                          ${user?.balance || 0}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg">
                      <LogIn size={20} className="text-green-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-400">Ultimo login</p>
                        <p className="text-sm font-semibold text-green-400">
                          {formatDate(user?.lastLogin || "")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={loadProfile}
                    className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={18} />
                    Actualizar Información
                  </button>
                </div>

                {/* Recargar Balance Section */}
                <div className="bg-gray-800 rounded-lg p-6 md:col-span-2">
                  <h3 className="text-xl font-bold text-white mb-4">
                    Recargar Balance
                  </h3>
                  <form onSubmit={handleTopUpSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Monto en COP
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        placeholder="Ej: 50000"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:outline-none transition"
                      />
                    </div>

                    <p className="text-sm text-gray-300">
                      Equivalente aproximado:
                      <span className="ml-1 font-semibold text-green-400">
                        {usdAmount} USD
                      </span>
                    </p>

                    <button
                      type="submit"
                      disabled={
                        isProcessingTopUp ||
                        !topUpAmount ||
                        Number(topUpAmount) <= 0
                      }
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isProcessingTopUp && (
                        <RefreshCw size={18} className="animate-spin" />
                      )}
                      Pagar con ePayco
                    </button>
                  </form>
                </div>
              </div>

              {/* Security Section */}
              <div className="mt-6 bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">Seguridad</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Contraseña Actual
                    </label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword: e.target.value,
                        })
                      }
                      placeholder="Ingresa tu contraseña actual"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:outline-none transition"
                      disabled={isChangingPassword}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Nueva Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            newPassword: e.target.value,
                          })
                        }
                        placeholder="Ingresa tu nueva contraseña"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:outline-none transition"
                        disabled={isChangingPassword}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Confirmar Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Confirma tu nueva contraseña"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:outline-none transition"
                      disabled={isChangingPassword}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isChangingPassword && (
                      <RefreshCw size={18} className="animate-spin" />
                    )}
                    Cambiar Contraseña
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
