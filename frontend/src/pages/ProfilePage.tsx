import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  TriangleAlert,
  LogIn,
} from "lucide-react";
import { authAPI, rankingAPI } from "../services/api";
import toast from "react-hot-toast";
import Navigation from "../components/Navigation";
import { PlayerStats } from "@/interfaces/PlayerStats";
import { AxiosError } from "axios";
import { UserProfile } from "../interfaces/User";

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

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = async () => {
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
  };

  const loadStats = async () => {
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
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-white mb-4">
                      Estadísticas Generales
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                        <span className="text-gray-300">Partidas Totales</span>
                        <span className="text-2xl font-bold text-green-400">
                          {stats.totalGames}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                        <span className="text-gray-300">Partidas Ganadas</span>
                        <span className="text-2xl font-bold text-green-400">
                          {stats.gamesWon}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                        <span className="text-gray-300">Partidas Perdidas</span>
                        <span className="text-2xl font-bold text-red-400">
                          {stats.gamesLost}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                        <span className="text-gray-300">Tasa de Victoria</span>
                        <span className="text-2xl font-bold text-blue-400">
                          {Math.round(stats.winRate)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Ganancia Total</span>
                        <span
                          className={`text-2xl font-bold ${
                            stats.totalProfit >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          ${stats.totalProfit}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-lg p-6 flex flex-col items-center justify-center">
                    <h3 className="flex flex-col items-center gap-2 text-xl font-bold text-orange-400 mb-4 text-center">
                      <TriangleAlert /> Necesitas jugar para ver tus
                      estadísticas
                    </h3>
                  </div>
                )}

                {/* Account Info Section */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4">
                    Información de Cuenta
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg">
                      <Mail size={20} className="text-green-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">Email</p>
                        <p className="text-sm font-semibold text-white truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg">
                      <Zap size={20} className="text-green-400" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-400">Balance Actual</p>
                        <p className="text-sm font-semibold text-green-400">
                          ${user?.balance || 0}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg">
                      <LogIn size={20} className="text-green-400" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-400">Ultimo login</p>
                        <p className="text-sm font-semibold text-green-400">
                          {formatDate(user?.lastLogin || "")}
                        </p>
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
