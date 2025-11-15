import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Menu, X, Home, Trophy, History, User, LogOut } from "lucide-react";
import toast from "react-hot-toast";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const menuItems = [
    { label: "Salas", icon: Home, path: "/lobby" },
    { label: "Ranking", icon: Trophy, path: "/ranking" },
    { label: "Historial", icon: History, path: "/history" },
    { label: "Perfil", icon: User, path: "/profile" },
  ];

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate("/");
    toast.success("Sesión cerrada");
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-gradient-to-br from-gray-900 via-green-900 to-green-900 z-30" />

      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50 ">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gray-800 p-2 rounded-lg text-white hover:bg-gray-700 transition"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed top-0 left-0 h-screen w-64 bg-gray-900 border-r border-gray-800 transform transition-transform z-40 md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-6 pt-16 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-green-400 mb-2">Blackjack</h1>
          <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
              <User size={16} className="text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 truncate">Jugador</p>
              <p className="text-sm font-semibold text-white truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="p-6 border-b border-gray-800">
          <p className="text-xs text-gray-400 mb-1">Balance</p>
          <p className="text-3xl font-bold text-green-400">
            ${user?.balance || 0}
          </p>
        </div>

        {/* Menu Items */}
        <nav className="p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition mb-2 ${
                  isActive(item.path)
                    ? "bg-green-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-800 mt-auto absolute bottom-0 left-0 right-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Desktop Navbar */}
      <nav className="hidden md:flex w-full bg-gray-900 border-b border-gray-800 px-8 py-4 items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-bold text-green-400">Blackjack</h1>
          <div className="flex gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    isActive(item.path)
                      ? "bg-green-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-semibold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-400">Balance</p>
            <p className="text-xl font-bold text-green-400">
              ${user?.balance || 0}
            </p>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-right max-w-xs">
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </nav>
    </>
  );
}
