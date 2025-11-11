// frontend/src/pages/LobbyPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { roomsAPI } from "../services/api";
import { socketService } from "../services/socketService";
import toast from "react-hot-toast";
import { CreateRoomModal } from "./CreateRoomModal";

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
  const [connecting, setConnecting] = useState(false);

  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();

  useEffect(() => {
    loadRooms();

    // Conectar socket solo una vez (NO unirse a ninguna sala aún)
    if (token && !socketService.isConnected()) {
      socketService.connect(token).catch((error) => {
        console.error("Failed to connect socket:", error);
        toast.error("Failed to connect to game server");
      });
    }

    const interval = setInterval(loadRooms, 10000);
    return () => clearInterval(interval);
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

  const handleJoinRoom = async (roomId: string) => {
    if (connecting) return;

    setConnecting(true);
    try {
      // Navegar a la sala
      // El socket join se hará en GamePage
      navigate(`/game/${roomId}`);
    } catch (error: any) {
      console.error("Error navigating to room:", error);
      toast.error("Failed to navigate to room");
    } finally {
      setConnecting(false);
    }
  };

  const handleLogout = () => {
    socketService.disconnect();
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-wrap justify-between items-center">
          <div>
            <h1 className="text-4xl font-semibold text-white mb-2">
              ♠️ ♥️ ♣️ ♦️ Blackjack Lobby
            </h1>
            <p className="text-gray-300">Choose a table and start playing</p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2 bg-gray-800 px-6 py-3 rounded-lg">
              <p className="text-sm text-gray-400">Balance</p>
              <p className="text-2xl font-bold text-green-400">
                ${user?.balance || 0}
              </p>
            </div>

            <div className="bg-gray-800 px-6 py-3 rounded-lg">
              <p className="text-sm text-gray-400">Player</p>
              <p className="text-sm font-semibold text-white">{user?.email}</p>
            </div>

            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mb-6 flex justify-between items-center">
        <button
          onClick={() => loadRooms()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
        >
          🔄 Refresh
        </button>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg transition"
        >
          + Create Room
        </button>
      </div>

      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center text-white text-xl">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center text-gray-400 text-xl">
            No rooms available. Create one to start playing!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white">{room.name}</h3>
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
                    <span>Type:</span>
                    <span className="font-semibold">
                      {room.isPublic ? "🌐 Public" : "🔒 Private"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Players:</span>
                    <span className="font-semibold">0/{room.maxPlayers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Bet:</span>
                    <span className="font-semibold text-green-400">
                      ${room.minBet}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Bet:</span>
                    <span className="font-semibold text-green-400">
                      ${room.maxBet}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created at:</span>
                    <span className="font-semibold text-green-400">
                      {room.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created by:</span>
                    <span className="font-semibold text-green-400">
                      {room.createdBy}
                    </span>
                  </div>
                </div>

                <button
                  className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleJoinRoom(room.id)}
                  disabled={connecting}
                >
                  {connecting ? "Joining..." : "Join Table"}
                </button>
              </div>
            ))}
          </div>
        )}
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
    </div>
  );
}
