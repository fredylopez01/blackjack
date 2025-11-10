import { Server } from "socket.io";
import { Deck, calculateHandValue, isBlackjack, isBusted } from "./Deck.js";
import { prisma } from "../index.js";
import { publishEvent } from "../services/rabbitmq.service.js";
import { logger } from "../utils/logger.js";

export class BlackjackGame {
  constructor(roomId, minBet, maxBet, maxPlayers, io) {
    this.roomId = roomId;
    this.minBet = minBet;
    this.maxBet = maxBet;
    this.maxPlayers = maxPlayers;
    this.io = io;
    this.deck = new Deck(6);
    this.players = new Map();
    this.spectators = new Set();
    this.dealerHand = [];
    this.status = "WAITING";
    this.currentPlayerIndex = 0;
    this.roundNumber = 0;
    this.gameSessionId = null;
    this.roundTimeout = null;
  }

  /**
   * Agrega un jugador a la partida
   */
  async addPlayer(playerInfo, socket) {
    if (this.players.size >= this.maxPlayers) {
      socket.emit("error", { message: "Room is full" });
      return false;
    }

    if (this.players.has(playerInfo.userId)) {
      socket.emit("error", { message: "Already in game" });
      return false;
    }

    // NO PERMITIR unirse si el juego ya está en progreso
    if (this.status !== "WAITING" && this.status !== "FINISHED") {
      socket.emit("error", { message: "Game already in progress" });
      return false;
    }

    const player = {
      ...playerInfo,
      hand: [],
      bet: 0,
      isStanding: false,
      isActive: true,
      isBusted: false,
      isBlackjack: false,
    };

    this.players.set(playerInfo.userId, player);

    // Crear sesión de juego si es el primer jugador
    if (this.players.size === 1 && !this.gameSessionId) {
      await this.createGameSession();
    }

    // Crear sesión de jugador en la BD
    await this.createPlayerSession(player);

    // Notificar a todos
    this.broadcastGameState();

    socket.emit("room-joined", {
      roomId: this.roomId,
      minBet: this.minBet,
      maxBet: this.maxBet,
      players: this.getPlayersInfo(),
    });

    logger.info(
      `Player ${playerInfo.username} added to game ${this.roomId} (${this.players.size}/${this.maxPlayers})`
    );

    // CAMBIO: Iniciar ronda solo si hay al menos 2 jugadores Y el estado es WAITING
    if (this.players.size >= 2 && this.status === "WAITING") {
      logger.info(`Starting betting phase with ${this.players.size} players`);
      setTimeout(() => {
        this.startBettingPhase();
      }, 3000); // 3 segundos de espera para que todos se conecten
    } else {
      logger.info(
        `Waiting for more players (${this.players.size}/${this.maxPlayers})`
      );
    }

    return true;
  }

  /**
   * Remueve un jugador de la partida
   */
  async removePlayer(userId, socketId) {
    const player = this.players.get(userId);

    if (!player) {
      return;
    }

    // Actualizar sesión en BD
    await this.updatePlayerSession(userId, false);

    this.players.delete(userId);
    this.spectators.delete(socketId);

    this.broadcastGameState();

    logger.info(`Player ${player.username} removed from game ${this.roomId}`);

    // Si no quedan jugadores, volver a WAITING
    if (this.players.size === 0) {
      this.status = "WAITING";
      this.roundNumber = 0;
      logger.info(`Room ${this.roomId} returned to WAITING state (no players)`);
    }

    // Si queda solo 1 jugador y está en juego, terminar la ronda
    if (this.players.size === 1 && this.status === "PLAYING") {
      logger.info(`Only 1 player left, ending round`);
      if (this.roundTimeout) {
        clearTimeout(this.roundTimeout);
      }
      await this.resolveRound();
    }
  }

  /**
   * Inicia la fase de apuestas
   */
  startBettingPhase() {
    // VALIDAR que haya al menos 2 jugadores
    if (this.players.size < 2) {
      logger.warn(
        `Cannot start betting phase with only ${this.players.size} player(s)`
      );
      this.status = "WAITING";
      return;
    }

    if (this.status !== "WAITING" && this.status !== "FINISHED") {
      return;
    }

    this.status = "BETTING";
    this.roundNumber++;

    // Resetear estado de jugadores
    for (const player of this.players.values()) {
      player.hand = [];
      player.bet = 0;
      player.isStanding = false;
      player.isBusted = false;
      player.isBlackjack = false;
      player.isActive = true;
    }

    this.dealerHand = [];
    this.currentPlayerIndex = 0;

    this.io.to(this.roomId).emit("betting-phase", {
      roundNumber: this.roundNumber,
      minBet: this.minBet,
      maxBet: this.maxBet,
      timeout: 30000, // 30 segundos para apostar
    });

    logger.info(`Betting phase started for round ${this.roundNumber}`);

    // Timeout para iniciar el reparto automáticamente
    this.roundTimeout = setTimeout(() => {
      this.startDealing();
    }, 30000);
  }

  /**
   * Procesa una apuesta de un jugador
   */
  async placeBet(userId, amount) {
    if (this.status !== "BETTING") {
      return false;
    }

    const player = this.players.get(userId);

    if (!player) {
      return false;
    }

    if (amount < this.minBet || amount > this.maxBet) {
      return false;
    }

    if (amount > player.balance) {
      return false;
    }

    player.bet = amount;
    player.balance -= amount;

    this.io.to(this.roomId).emit("bet-placed", {
      userId,
      username: player.username,
      amount,
    });

    logger.info(`Player ${player.username} bet ${amount}`);

    // Si todos apostaron, iniciar reparto
    const allBetsPlaced = Array.from(this.players.values()).every(
      (p) => p.bet > 0
    );

    if (allBetsPlaced) {
      logger.info("All players placed bets, starting dealing");
      if (this.roundTimeout) {
        clearTimeout(this.roundTimeout);
      }
      this.startDealing();
    }

    return true;
  }

  /**
   * Inicia el reparto de cartas
   */
  async startDealing() {
    // Filtrar solo jugadores que apostaron
    const playersWithBets = Array.from(this.players.values()).filter(
      (p) => p.bet > 0
    );

    if (playersWithBets.length === 0) {
      logger.warn("No players placed bets, returning to waiting");
      this.status = "WAITING";
      return;
    }

    this.status = "DEALING";

    // Verificar si el mazo necesita mezclarse
    if (this.deck.needsShuffle()) {
      this.deck = new Deck(6);
      this.io.to(this.roomId).emit("deck-shuffled");
    }

    // Primera carta a todos
    for (const player of playersWithBets) {
      const card = this.deck.deal();
      if (card) player.hand.push(card);
    }
    const dealerFirstCard = this.deck.deal();
    if (dealerFirstCard) this.dealerHand.push(dealerFirstCard);

    // Segunda carta a todos
    for (const player of playersWithBets) {
      const card = this.deck.deal();
      if (card) player.hand.push(card);
    }
    const dealerSecondCard = this.deck.deal();
    if (dealerSecondCard) this.dealerHand.push(dealerSecondCard);

    // Verificar blackjacks
    for (const player of playersWithBets) {
      if (isBlackjack(player.hand)) {
        player.isBlackjack = true;
      }
    }

    // Broadcast del reparto (dealer muestra solo una carta)
    this.io.to(this.roomId).emit("cards-dealt", {
      players: playersWithBets.map((p) => ({
        userId: p.userId,
        username: p.username,
        hand: p.hand,
        value: calculateHandValue(p.hand),
        isBlackjack: p.isBlackjack,
      })),
      dealer: {
        hand: [this.dealerHand[0], { suit: "back", rank: "?", value: 0 }],
        value: this.dealerHand[0].value,
      },
    });

    logger.info(`Cards dealt to ${playersWithBets.length} players`);

    // Si el dealer tiene blackjack, terminar inmediatamente
    if (isBlackjack(this.dealerHand)) {
      await this.dealerTurn();
      return;
    }

    // Iniciar turnos de jugadores
    setTimeout(() => {
      this.status = "PLAYING";
      this.nextPlayerTurn();
    }, 2000);
  }

  /**
   * Avanza al siguiente turno de jugador
   */
  nextPlayerTurn() {
    const playersArray = Array.from(this.players.values()).filter(
      (p) => p.bet > 0
    );

    // Buscar el siguiente jugador activo
    while (this.currentPlayerIndex < playersArray.length) {
      const player = playersArray[this.currentPlayerIndex];

      if (!player.isStanding && !player.isBusted && !player.isBlackjack) {
        this.io.to(this.roomId).emit("player-turn", {
          userId: player.userId,
          username: player.username,
          hand: player.hand,
          value: calculateHandValue(player.hand),
          timeout: 30000,
        });

        // Timeout para stand automático
        this.roundTimeout = setTimeout(() => {
          this.stand(player.userId);
        }, 30000);

        return;
      }

      this.currentPlayerIndex++;
    }

    // Todos los jugadores terminaron, turno del dealer
    this.dealerTurn();
  }

  /**
   * Jugador pide carta
   */
  async hit(userId) {
    if (this.status !== "PLAYING") {
      return false;
    }

    const player = this.players.get(userId);

    if (!player || player.isStanding || player.isBusted) {
      return false;
    }

    const card = this.deck.deal();
    if (!card) return false;

    player.hand.push(card);
    const value = calculateHandValue(player.hand);

    this.io.to(this.roomId).emit("card-dealt", {
      userId,
      card,
      hand: player.hand,
      value,
    });

    // Verificar si se pasó
    if (isBusted(player.hand)) {
      player.isBusted = true;
      player.isActive = false;

      this.io.to(this.roomId).emit("player-busted", {
        userId,
        username: player.username,
      });

      if (this.roundTimeout) {
        clearTimeout(this.roundTimeout);
      }

      this.currentPlayerIndex++;
      this.nextPlayerTurn();
    }

    return true;
  }

  /**
   * Jugador se planta
   */
  async stand(userId) {
    if (this.status !== "PLAYING") {
      return false;
    }

    const player = this.players.get(userId);

    if (!player) {
      return false;
    }

    player.isStanding = true;

    this.io.to(this.roomId).emit("player-stood", {
      userId,
      username: player.username,
    });

    if (this.roundTimeout) {
      clearTimeout(this.roundTimeout);
    }

    this.currentPlayerIndex++;
    this.nextPlayerTurn();

    return true;
  }

  /**
   * Turno del dealer
   */
  async dealerTurn() {
    this.status = "DEALER_TURN";

    // Revelar carta oculta del dealer
    this.io.to(this.roomId).emit("dealer-reveal", {
      hand: this.dealerHand,
      value: calculateHandValue(this.dealerHand),
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Dealer debe pedir hasta 17
    while (calculateHandValue(this.dealerHand) < 17) {
      const card = this.deck.deal();
      if (!card) break;

      this.dealerHand.push(card);

      this.io.to(this.roomId).emit("dealer-hit", {
        card,
        hand: this.dealerHand,
        value: calculateHandValue(this.dealerHand),
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // Determinar ganadores y pagar
    await this.resolveRound();
  }

  /**
   * Resuelve la ronda y determina ganadores
   */
  async resolveRound() {
    this.status = "FINISHED";

    const dealerValue = calculateHandValue(this.dealerHand);
    const dealerBusted = isBusted(this.dealerHand);
    const dealerBlackjack = isBlackjack(this.dealerHand);

    const results = [];

    for (const player of this.players.values()) {
      if (player.bet === 0) continue;

      const playerValue = calculateHandValue(player.hand);
      let result = "lose";
      let payout = 0;

      if (player.isBlackjack && !dealerBlackjack) {
        // Blackjack paga 3:2
        result = "win";
        payout = player.bet + Math.floor(player.bet * 1.5);
      } else if (player.isBusted) {
        result = "lose";
        payout = 0;
      } else if (dealerBusted) {
        result = "win";
        payout = player.bet * 2;
      } else if (playerValue > dealerValue) {
        result = "win";
        payout = player.bet * 2;
      } else if (playerValue === dealerValue) {
        result = "push";
        payout = player.bet;
      } else {
        result = "lose";
        payout = 0;
      }

      player.balance += payout;

      results.push({
        userId: player.userId,
        username: player.username,
        hand: player.hand,
        value: playerValue,
        bet: player.bet,
        result,
        payout,
        balance: player.balance,
      });

      // Actualizar estadísticas del jugador
      await this.updatePlayerStats(player.userId, result, payout - player.bet);
    }

    // Broadcast de resultados
    this.io.to(this.roomId).emit("round-finished", {
      roundNumber: this.roundNumber,
      dealer: {
        hand: this.dealerHand,
        value: dealerValue,
        busted: dealerBusted,
        blackjack: dealerBlackjack,
      },
      results,
    });

    logger.info(`Round ${this.roundNumber} finished for room ${this.roomId}`);

    // Guardar ronda en BD y publicar evento
    await this.saveRound(results);
    await publishEvent("game.round.completed", {
      roomId: this.roomId,
      roundNumber: this.roundNumber,
      results,
    });

    // CAMBIO: Iniciar nueva ronda solo si hay al menos 2 jugadores
    setTimeout(() => {
      if (this.players.size >= 2) {
        this.startBettingPhase();
      } else {
        logger.info(
          `Not enough players (${this.players.size}), returning to WAITING`
        );
        this.status = "WAITING";
        this.roundNumber = 0;
      }
    }, 10000);
  }

  // Métodos auxiliares

  async createGameSession() {
    try {
      const session = await prisma.gameSession.create({
        data: {
          roomId: this.roomId,
          minBet: this.minBet,
          maxBet: this.maxBet,
          status: "IN_PROGRESS",
        },
      });
      this.gameSessionId = session.id;
    } catch (error) {
      logger.error("Error creating game session:", error);
    }
  }

  async createPlayerSession(player) {
    if (!this.gameSessionId) return;

    try {
      await prisma.playerSession.create({
        data: {
          gameId: this.gameSessionId,
          userId: player.userId,
          username: player.username,
          initialBalance: player.balance,
          currentBalance: player.balance,
        },
      });
    } catch (error) {
      logger.error("Error creating player session:", error);
    }
  }

  async updatePlayerSession(userId, isActive) {
    try {
      if (!this.gameSessionId) return;

      const session = await prisma.playerSession.findFirst({
        where: { gameId: this.gameSessionId, userId },
      });

      if (!session) return;

      const updateData = {
        currentBalance:
          this.players.get(userId)?.balance ?? session.currentBalance,
      };

      if (!isActive) updateData.leftAt = new Date();

      await prisma.playerSession.update({
        where: { id: session.id },
        data: updateData,
      });
    } catch (error) {
      logger.error("Error updating player session:", error);
    }
  }

  async updatePlayerStats(userId, result, profit) {
    try {
      if (!this.gameSessionId) return;

      const session = await prisma.playerSession.findFirst({
        where: { gameId: this.gameSessionId, userId },
      });

      if (!session) return;

      const data = {
        roundsPlayed: { increment: 1 },
        totalWon: { increment: Math.max(0, profit || 0) },
        currentBalance:
          this.players.get(userId)?.balance ?? session.currentBalance,
      };

      if (result === "win") data.roundsWon = { increment: 1 };
      if (result === "lose") data.roundsLost = { increment: 1 };
      if (result === "push") data.roundsPush = { increment: 1 };

      await prisma.playerSession.update({
        where: { id: session.id },
        data,
      });
    } catch (error) {
      logger.error("Error updating player stats:", error);
    }
  }

  async saveRound(results) {
    try {
      if (!this.gameSessionId) return;

      const round = await prisma.round.create({
        data: {
          gameId: this.gameSessionId,
          roundNumber: this.roundNumber,
          dealerHand: this.dealerHand,
        },
      });

      for (const r of results) {
        try {
          const playerSession = await prisma.playerSession.findFirst({
            where: { gameId: this.gameSessionId, userId: r.userId },
          });

          if (!playerSession) continue;

          let handResult = null;
          if (r.result === "win") handResult = "WIN";
          else if (r.result === "lose") handResult = "LOSE";
          else if (r.result === "push") handResult = "PUSH";

          await prisma.hand.create({
            data: {
              roundId: round.id,
              playerId: playerSession.id,
              cards: r.hand || [],
              bet: r.bet || 0,
              result: handResult,
              payout: r.payout || 0,
              isBlackjack: !!r.isBlackjack,
              isBusted: !!r.isBusted,
              value: r.value || 0,
            },
          });
        } catch (err) {
          logger.error("Error saving hand for user", r.userId, err);
        }
      }

      await prisma.gameSession.update({
        where: { id: this.gameSessionId },
        data: { totalRounds: this.roundNumber },
      });
    } catch (error) {
      logger.error("Error saving round:", error);
    }
  }

  getPlayersInfo() {
    return Array.from(this.players.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      balance: p.balance,
    }));
  }

  broadcastGameState() {
    this.io.to(this.roomId).emit("game-state", {
      status: this.status,
      roundNumber: this.roundNumber,
      players: this.getPlayersInfo(),
      playerCount: this.players.size,
    });
  }

  getPlayerCount() {
    return this.players.size;
  }

  getStatus() {
    return this.status;
  }

  getCurrentRound() {
    return this.roundNumber;
  }

  async endGame() {
    if (this.gameSessionId) {
      await prisma.gameSession.update({
        where: { id: this.gameSessionId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          totalRounds: this.roundNumber,
        },
      });
    }
  }
}
