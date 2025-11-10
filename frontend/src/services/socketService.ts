import { io, Socket } from "socket.io-client";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

const WS_URL = "http://localhost:3002";

class SocketService {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private connectionPromise: Promise<void> | null = null;

  connect(token: string): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = io(WS_URL, {
        path: "/game/socket.io",
        auth: { token },
        transports: ["websocket", "polling"],
      });

      this.socket.on("connect", () => {
        this.connectionPromise = null;
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("Connection error:", error);
        this.connectionPromise = null;
        reject(error);
      });

      this.setupListeners();
    });

    return this.connectionPromise;
  }

  getSocketId(): string | null {
    return this.socket?.id ?? null;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomId = null;
    this.connectionPromise = null;
  }

  async joinRoom(roomId: string): Promise<void> {
    // Asegurarse de que el socket está conectado
    if (!this.socket?.connected) {
      toast.error("Not connected to game server");
      throw new Error("Socket not connected");
    }

    this.roomId = roomId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Join room timeout"));
      }, 10000);

      this.socket!.once("room-joined", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once("error", (data) => {
        clearTimeout(timeout);
        reject(new Error(data.message));
      });

      this.socket!.emit("join-room", {
        roomId: this.roomId,
        token: useAuthStore.getState().token,
      });
    });
  }

  placeBet(amount: number): void {
    if (!this.socket?.connected) {
      toast.error("Not connected to game server");
      return;
    }

    this.socket.emit("place-bet", { amount });
  }

  hit(): void {
    if (!this.socket?.connected) {
      toast.error("Not connected to game server");
      return;
    }

    this.socket.emit("hit");
  }

  stand(): void {
    if (!this.socket?.connected) {
      toast.error("Not connected to game server");
      return;
    }

    this.socket.emit("stand");
  }

  private setupListeners(): void {
    if (!this.socket) return;

    // Conexión exitosa
    this.socket.on("connect", () => {
      toast.success("Connected to game server");
    });

    // Error de conexión
    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      toast.error("Failed to connect to game server");
    });

    // Desconexión
    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      toast.error("Disconnected from game server");
    });

    // Unirse a sala exitosamente
    this.socket.on("room-joined", (data) => {
      toast.success(`Joined room: ${data.roomId}`);
      useGameStore.getState().setRoomId(data.roomId);
    });

    // Estado del juego
    this.socket.on("game-state", (data) => {
      useGameStore.getState().setGameStatus(data.status);
      useGameStore.getState().setPlayers(data.players || []);
    });

    // Fase de apuestas
    this.socket.on("betting-phase", (data) => {
      console.log("Betting phase started:", data);
      useGameStore.getState().setGameStatus("BETTING");
      useGameStore.getState().setRoundNumber(data.roundNumber);
      useGameStore.getState().setBetLimits(data.minBet, data.maxBet);
      toast("Place your bets!", { icon: "🎰" });
    });

    // Apuesta realizada
    this.socket.on("bet-placed", (data) => {
      toast.success(`${data.username} bet $${data.amount}`);
    });

    this.socket.on("bet-placed-success", (data) => {
      useGameStore.getState().setMyBet(data.amount);
      toast.success(`Bet placed: $${data.amount}`);
    });

    // Cartas repartidas
    this.socket.on("cards-dealt", (data) => {
      console.log("Cards dealt:", data);
      useGameStore.getState().setGameStatus("DEALING");
      useGameStore.getState().setPlayers(data.players);
      useGameStore
        .getState()
        .setDealerHand(data.dealer.hand, data.dealer.value);

      // Encontrar mi mano
      const userId = useAuthStore.getState().user?.id;
      const myPlayer = data.players.find((p: any) => p.userId === userId);
      if (myPlayer) {
        useGameStore.getState().setMyHand(myPlayer.hand);
      }
    });

    // Turno de jugador
    this.socket.on("player-turn", (data) => {
      console.log("Player turn:", data);
      useGameStore.getState().setGameStatus("PLAYING");
      useGameStore.getState().setCurrentPlayerTurn(data.userId);

      const userId = useAuthStore.getState().user?.id;
      if (data.userId === userId) {
        toast("Your turn!", { icon: "🎲" });
      } else {
        toast(`${data.username}'s turn`);
      }
    });

    // Carta repartida
    this.socket.on("card-dealt", (data) => {
      const userId = useAuthStore.getState().user?.id;
      if (data.userId === userId) {
        useGameStore.getState().setMyHand(data.hand);
      }
    });

    // Jugador se pasó
    this.socket.on("player-busted", (data) => {
      const userId = useAuthStore.getState().user?.id;
      if (data.userId === userId) {
        toast.error("Busted!");
      } else {
        toast(`${data.username} busted!`, { icon: "💥" });
      }
    });

    // Jugador se plantó
    this.socket.on("player-stood", (data) => {
      const userId = useAuthStore.getState().user?.id;
      if (data.userId === userId) {
        toast.success("Standing");
      } else {
        toast(`${data.username} stands`);
      }
    });

    // Revelar carta del dealer
    this.socket.on("dealer-reveal", (data) => {
      useGameStore.getState().setGameStatus("DEALER_TURN");
      useGameStore.getState().setDealerHand(data.hand, data.value);
      toast("Dealer reveals...", { icon: "🎭" });
    });

    // Dealer pide carta
    this.socket.on("dealer-hit", (data) => {
      useGameStore.getState().setDealerHand(data.hand, data.value);
    });

    // Ronda terminada
    this.socket.on("round-finished", (data) => {
      console.log("Round finished:", data);
      useGameStore.getState().setGameStatus("FINISHED");

      const userId = useAuthStore.getState().user?.id;
      const myResult = data.results.find((r: any) => r.userId === userId);

      if (myResult) {
        useAuthStore.getState().updateBalance(myResult.balance);

        if (myResult.result === "win") {
          toast.success(`You won $${myResult.payout}! 🎉`);
        } else if (myResult.result === "lose") {
          toast.error("You lost!");
        } else {
          toast("Push! Bet returned", { icon: "🤝" });
        }
      }
    });

    // Errores
    this.socket.on("error", (data) => {
      console.error("Socket error:", data);
      toast.error(data.message || "An error occurred");
    });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
