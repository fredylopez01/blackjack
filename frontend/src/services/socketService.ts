// frontend/src/services/socketService.ts
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
        console.log("✅ Socket connected:", this.socket?.id);
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
        console.log("✅ Joined room:", roomId);
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

  startGame(): void {
    if (!this.socket?.connected) {
      toast.error("Not connected to game server");
      return;
    }

    if (!this.roomId) {
      toast.error("Not in a room");
      return;
    }

    console.log("🎮 Requesting game start for room:", this.roomId);
    this.socket.emit("start-game");
    toast.loading("Starting game...", { duration: 2000 });
  }

  placeBet(amount: number): void {
    if (!this.socket?.connected) {
      toast.error("Not connected to game server");
      return;
    }

    console.log("💰 Placing bet:", amount);
    this.socket.emit("place-bet", { amount });
  }

  hit(): void {
    if (!this.socket?.connected) {
      toast.error("Not connected to game server");
      return;
    }

    console.log("🎴 Hitting...");
    this.socket.emit("hit");
  }

  stand(): void {
    if (!this.socket?.connected) {
      toast.error("Not connected to game server");
      return;
    }

    console.log("✋ Standing...");
    this.socket.emit("stand");
  }

  private setupListeners(): void {
    if (!this.socket) return;

    // Conexión exitosa
    this.socket.on("connect", () => {
      console.log("🔌 Connected to game server");
      toast.success("Connected to game server");
    });

    // Error de conexión
    this.socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error);
      toast.error("Failed to connect to game server");
    });

    // Desconexión
    this.socket.on("disconnect", (reason) => {
      console.log("🔌 Disconnected:", reason);
      toast.error("Disconnected from game server");
    });

    // Unirse a sala exitosamente
    this.socket.on("room-joined", (data) => {
      console.log("🚪 Room joined:", data);
      toast.success(`Joined ${data.roomId.slice(0, 8)}...`);
      useGameStore.getState().setRoomId(data.roomId);
    });

    // Estado del juego
    this.socket.on("game-state", (data) => {
      console.log("📊 Game state:", data);
      useGameStore.getState().setGameStatus(data.status);
      useGameStore.getState().setPlayers(data.players || []);
    });

    // Fase de apuestas
    this.socket.on("betting-phase", (data) => {
      console.log("💰 Betting phase:", data);
      useGameStore.getState().setGameStatus("BETTING");
      useGameStore.getState().setRoundNumber(data.roundNumber);
      useGameStore.getState().setBetLimits(data.minBet, data.maxBet);
      toast("Place your bets! 🎰", { duration: 5000, icon: "💰" });
    });

    // Apuesta realizada por otro jugador
    this.socket.on("bet-placed", (data) => {
      console.log("💵 Bet placed:", data);
      toast(`${data.username} bet $${data.amount}`, { icon: "💵" });
    });

    // Mi apuesta fue aceptada
    this.socket.on("bet-placed-success", (data) => {
      console.log("✅ My bet placed:", data);
      useGameStore.getState().setMyBet(data.amount);
      toast.success(`Bet placed: $${data.amount}`);
    });

    // Cartas repartidas
    this.socket.on("cards-dealt", (data) => {
      console.log("🎴 Cards dealt:", data);
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

        if (myPlayer.isBlackjack) {
          toast.success("BLACKJACK! 🎉", { duration: 5000 });
        }
      }
    });

    // Turno de jugador
    this.socket.on("player-turn", (data) => {
      console.log("🎯 Player turn:", data);
      useGameStore.getState().setGameStatus("PLAYING");
      useGameStore.getState().setCurrentPlayerTurn(data.userId);

      const userId = useAuthStore.getState().user?.id;
      if (data.userId === userId) {
        toast("Your turn! 🎲", { duration: 10000, icon: "⭐" });
      } else {
        toast(`${data.username}'s turn`, { duration: 3000 });
      }
    });

    // Carta repartida
    this.socket.on("card-dealt", (data) => {
      console.log("🃏 Card dealt:", data);
      const userId = useAuthStore.getState().user?.id;
      if (data.userId === userId) {
        useGameStore.getState().setMyHand(data.hand);
        toast(`You got ${data.card.rank}${data.card.suit}`, { icon: "🎴" });
      }
    });

    // Jugador se pasó
    this.socket.on("player-busted", (data) => {
      console.log("💥 Player busted:", data);
      const userId = useAuthStore.getState().user?.id;
      if (data.userId === userId) {
        toast.error("Busted! 💥", { duration: 5000 });
      } else {
        toast(`${data.username} busted!`, { icon: "💥" });
      }
    });

    // Jugador se plantó
    this.socket.on("player-stood", (data) => {
      console.log("✋ Player stood:", data);
      const userId = useAuthStore.getState().user?.id;
      if (data.userId === userId) {
        toast.success("Standing ✋");
      } else {
        toast(`${data.username} stands`, { icon: "✋" });
      }
    });

    // Revelar carta del dealer
    this.socket.on("dealer-reveal", (data) => {
      console.log("🎭 Dealer reveal:", data);
      useGameStore.getState().setGameStatus("DEALER_TURN");
      useGameStore.getState().setDealerHand(data.hand, data.value);
      toast("Dealer reveals... 🎭", { duration: 3000 });
    });

    // Dealer pide carta
    this.socket.on("dealer-hit", (data) => {
      console.log("🎴 Dealer hit:", data);
      useGameStore.getState().setDealerHand(data.hand, data.value);
    });

    // Ronda terminada
    this.socket.on("round-finished", (data) => {
      console.log("🏁 Round finished:", data);
      useGameStore.getState().setGameStatus("FINISHED");

      const userId = useAuthStore.getState().user?.id;
      const myResult = data.results.find((r: any) => r.userId === userId);

      if (myResult) {
        useAuthStore.getState().updateBalance(myResult.balance);

        if (myResult.result === "win") {
          toast.success(`You won $${myResult.payout}! 🎉`, { duration: 8000 });
        } else if (myResult.result === "lose") {
          toast.error(`You lost $${myResult.bet} 😢`, { duration: 5000 });
        } else {
          toast("Push! Bet returned 🤝", { icon: "🤝", duration: 5000 });
        }
      }

      // Mostrar resumen de resultados
      setTimeout(() => {
        const winners = data.results.filter((r: any) => r.result === "win");
        if (winners.length > 0) {
          const winnerNames = winners.map((w: any) => w.username).join(", ");
          toast(`Winners: ${winnerNames} 🏆`, { duration: 5000 });
        }
      }, 2000);
    });

    // Errores
    this.socket.on("error", (data) => {
      console.error("❌ Socket error:", data);
      toast.error(data.message || "An error occurred");
    });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
