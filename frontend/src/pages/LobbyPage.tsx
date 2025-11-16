// frontend/src/pages/LobbyPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { roomsAPI } from "../services/api";
import { socketService } from "../services/socketService";
import toast from "react-hot-toast";
import { CreateRoomModal } from "./CreateRoomModal";
import { Globe, GlobeLock, Plus, RefreshCcw, RefreshCw } from "lucide-react";
import { EnterPasswordModal } from "./EnterPassword";
import Navigation from "../components/Navigation";

interface Room {
  id: string;
  name: string;
  isPublic: boolean;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  status: string;
  createdAt: string;
  createdBy: string;
}

export default function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  useEffect(() => {
    loadRooms();

    // Conectar socket solo una vez (NO unirse a ninguna sala aún)
    if (token && !socketService.isConnected()) {
      socketService.connect(token).catch((error) => {
        console.error("Failed to connect socket:", error);
        toast.error("Failed to connect to game server");
      });
    }
  }, [token]);

  const loadRooms = async () => {
    try {
      const data = await roomsAPI.list();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error("Error loading rooms:", error);
      toast.error("Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (
    roomId: string,
    isPublic: boolean,
    owner: string
  ) => {
    if (!isPublic) {
      if (owner === user?.email) {
        // El creador de la sala no necesita contraseña
        joinRoom(roomId);
      } else {
        setSelectedRoomId(roomId);
        setShowAddPassword(true);
      }
    } else {
      if (connecting) return;
      joinRoom(roomId);
    }
  };

  const joinRoom = async (roomId: string, password?: string) => {
    setConnecting(true);
    try {
      // Navegar a la sala
      // El socket join se hará en GamePage
      navigate(`/game/${roomId}`, { state: { password } });
    } catch (error: any) {
      console.error("Error navigating to room:", error);
      toast.error("Failed to navigate to room");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900">
      <Navigation />

      <div className="p-4 md:p-8 mt-16 md:mt-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-3xl font-semibold text-white mb-2">
                Salas de Juego
              </h1>
              <p className="text-gray-300 text-sm">
                Elige una mesa y comienza a jugar
              </p>
            </div>

            {/* Controls */}
            <div className="mb-6 flex gap-3 items-center">
              <button
                onClick={() => loadRooms()}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
              >
                <RefreshCcw size={18} /> Actualizar
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
              >
                <Plus size={18} /> Crear Sala
              </button>
            </div>
          </div>

          {/* Rooms Grid */}
          {loading ? (
            <div className="text-center text-gray-300 py-12">
              <div className="inline-block animate-spin">
                <RefreshCw size={32} className="text-green-400" />
              </div>
              <p className="mt-4 text-gray-400">Cargando salas...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center text-gray-400 text-xl py-12">
              No hay salas disponibles. ¡Crea una para comenzar!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white">
                      {room.name}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        room.status === "WAITING"
                          ? "bg-green-600 text-white"
                          : room.status === "PLAYING"
                          ? "bg-yellow-600 text-white"
                          : "bg-gray-600 text-white"
                      }`}
                    >
                      {room.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-gray-300">
                    <div className="flex justify-between">
                      <span>Tipo:</span>
                      <span className="font-semibold flex items-center gap-1">
                        {room.isPublic ? (
                          <>
                            <Globe size={20} /> Pública
                          </>
                        ) : (
                          <>
                            <GlobeLock size={20} /> Privada
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Jugadores:</span>
                      <span className="font-semibold">0/{room.maxPlayers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Apuesta Mín:</span>
                      <span className="font-semibold text-green-400">
                        ${room.minBet}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Apuesta Máx:</span>
                      <span className="font-semibold text-green-400">
                        ${room.maxBet}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Creado por:</span>
                      <span className="font-semibold text-green-400 truncate">
                        {room.createdBy}
                      </span>
                    </div>
                  </div>

                  <button
                    className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() =>
                      handleJoinRoom(room.id, room.isPublic, room.createdBy)
                    }
                    disabled={connecting}
                  >
                    {connecting ? "Uniéndose..." : "Unirse"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadRooms();
          }}
        />
      )}

      {showAddPassword && (
        <EnterPasswordModal
          onClose={() => setShowAddPassword(false)}
          onSuccess={(password: string) => {
            setShowCreateModal(false);
            joinRoom(selectedRoomId!, password);
          }}
        />
      )}
    </div>
  );
}
