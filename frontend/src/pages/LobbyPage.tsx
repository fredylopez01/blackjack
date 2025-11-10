import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { roomsAPI } from "../services/api";
import { socketService } from "../services/socketService";
import toast from "react-hot-toast";

interface Room {
  id: string;
  name: string;
  isPublic: boolean;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  status: string;
  createdAt: string;
}

export default function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();

  useEffect(() => {
    loadRooms();

    // Conectar socket cuando entramos al lobby
    if (token) {
      socketService.connect(token);
    }

    // Recargar salas cada 10 segundos
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
    try {
      const response = await roomsAPI.join(roomId);
      toast.success("Joining room...");

      // Conectar al juego via WebSocket
      socketService.joinRoom(roomId);

      // Navegar a la página del juego
      navigate(`/game/${roomId}`);
    } catch (error: any) {
      console.error("Error joining room:", error);
      toast.error(error.response?.data?.error || "Failed to join room");
    }
  };

  const handleLogout = () => {
    socketService.disconnect();
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              ♠️ Blackjack Lobby
            </h1>
            <p className="text-gray-300">Choose a table and start playing</p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-gray-800 px-6 py-3 rounded-lg">
              <p className="text-sm text-gray-400">Balance</p>
              <p className="text-2xl font-bold text-green-400">
                ${user?.balance || 0}
              </p>
            </div>

            <div className="bg-gray-800 px-6 py-3 rounded-lg">
              <p className="text-sm text-gray-400">Player</p>
              <p className="text-lg font-semibold text-white">{user?.email}</p>
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

      {/* Actions */}
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

      {/* Rooms Grid */}
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
                className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition cursor-pointer"
                onClick={() => handleJoinRoom(room.id)}
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
                </div>

                <button
                  className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJoinRoom(room.id);
                  }}
                >
                  Join Table
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
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

// Modal para crear sala
function CreateRoomModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [minBet, setMinBet] = useState(10);
  const [maxBet, setMaxBet] = useState(1000);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await roomsAPI.create({
        name,
        isPublic,
        minBet,
        maxBet,
        maxPlayers,
      });

      toast.success("Room created!");
      onSuccess();
    } catch (error: any) {
      console.error("Error creating room:", error);
      toast.error(error.response?.data?.error || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-6">Create New Room</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="My Blackjack Table"
            />
          </div>

          <div>
            <label className="flex items-center space-x-2 text-gray-300">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-5 h-5"
              />
              <span>Public Room</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Min Bet
              </label>
              <input
                type="number"
                value={minBet}
                onChange={(e) => setMinBet(Number(e.target.value))}
                min="1"
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Bet
              </label>
              <input
                type="number"
                value={maxBet}
                onChange={(e) => setMaxBet(Number(e.target.value))}
                min={minBet}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Players
            </label>
            <input
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              min="1"
              max="7"
              required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
