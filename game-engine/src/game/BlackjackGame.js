// game-engine/src/game/BlackjackGame.js
import { Server } from "socket.io";
import axios from "axios";
import { Deck, calculateHandValue, isBlackjack, isBusted } from "./Deck.js";
import { prisma } from "../index.js";
import { publishEvent } from "../services/rabbitmq.service.js";
import { MainAppSyncService } from "../services/mainAppSyncService.js";
import { serviceTokenManager } from "../services/serviceTokenManager.js";
import { logger } from "../utils/logger.js";

const AUTH_API_URL = process.env.AUTH_API_URL;

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

  async addPlayer(playerInfo, socket) {
    if (this.players.size >= this.maxPlayers) {
      socket.emit("error", { message: "Room is full" });
      return false;
    }

    if (this.players.has(playerInfo.userId)) {
      socket.emit("error", { message: "Already in game" });
      return false;
    }

    // PERMITIR unirse en WAITING, BETTING y FINISHED
    if (
      this.status !== "WAITING" &&
      this.status !== "BETTING" &&
      this.status !== "FINISHED"
    ) {
      socket.emit("error", {
        message: "Game in progress, wait for next round",
      });
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
      `Player ${playerInfo.username} joined game ${this.roomId} (${this.players.size}/${this.maxPlayers})`
    );

    // NO iniciar automáticamente - esperar comando explícito
    return true;
  }

  async removePlayer(userId, socketId) {
    const player = this.players.get(userId);

    if (!player) {
      return;
    }

    await this.updatePlayerSession(userId, false);

    this.players.delete(userId);
    this.spectators.delete(socketId);

    this.broadcastGameState();

    logger.info(`Player ${player.username} removed from game ${this.roomId}`);

    if (this.players.size === 0) {
      // Mark session completed and clear session id so next join creates a new GameSession
      this.status = "WAITING";
      this.roundNumber = 0;
      logger.info(`Room ${this.roomId} returned to WAITING (no players)`);

      try {
        if (this.gameSessionId) {
          await this.endGame();
          // clear session id so next game creates a new GameSession
          this.gameSessionId = null;
          logger.info(`Game session for room ${this.roomId} ended and cleared`);
        }
      } catch (err) {
        logger.error("Error finalizing game session on empty room:", err);
      }
    }

    // Si menos de 2 jugadores en cualquier estado activo, volver a WAITING
    if (
      this.players.size < 2 &&
      this.status !== "WAITING" &&
      this.status !== "FINISHED"
    ) {
      logger.info(
        `Only ${this.players.size} player(s) left, returning to WAITING`
      );
      this.status = "WAITING";
      if (this.roundTimeout) {
        clearTimeout(this.roundTimeout);
      }
      this.broadcastGameState();
    }

    if (this.players.size === 1 && this.status === "PLAYING") {
      logger.info(`Only 1 player left, ending round`);
      if (this.roundTimeout) {
        clearTimeout(this.roundTimeout);
      }
      await this.resolveRound();
    }
  }

  startBettingPhase() {
    if (this.players.size < 2) {
      logger.warn(
        `Cannot start betting phase with only ${this.players.size} player(s)`
      );
      return false;
    }

    if (this.status !== "WAITING" && this.status !== "FINISHED") {
      logger.warn(`Cannot start betting from status: ${this.status}`);
      return false;
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

    // Broadcast state update para limpiar tablero en frontend
    this.broadcastGameState();

    this.io.to(this.roomId).emit("betting-phase", {
      roundNumber: this.roundNumber,
      minBet: this.minBet,
      maxBet: this.maxBet,
      timeout: 30000,
    });

    logger.info(`Betting phase started for round ${this.roundNumber}`);

    // Timeout para iniciar el reparto automáticamente
    this.roundTimeout = setTimeout(() => {
      this.startDealing();
    }, 30000);

    return true;
  }

  async placeBet(userId, amount) {
    if (this.status !== "BETTING") {
      return false;
    }

    const player = this.players.get(userId);

    if (!player) {
      return false;
    }

    if (player.bet > 0) {
      return false; // Ya apostó
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

  async startDealing() {
    const playersWithBets = Array.from(this.players.values()).filter(
      (p) => p.bet > 0
    );

    if (playersWithBets.length === 0) {
      logger.warn("No players placed bets, returning to waiting");
      this.status = "WAITING";
      return;
    }

    this.status = "DEALING";

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

    // Broadcast del reparto
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

    if (isBlackjack(this.dealerHand)) {
      await this.dealerTurn();
      return;
    }

    setTimeout(() => {
      this.status = "PLAYING";
      this.nextPlayerTurn();
    }, 2000);
  }

  nextPlayerTurn() {
    const playersArray = Array.from(this.players.values()).filter(
      (p) => p.bet > 0
    );

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

        this.roundTimeout = setTimeout(() => {
          this.stand(player.userId);
        }, 30000);

        return;
      }

      this.currentPlayerIndex++;
    }

    this.dealerTurn();
  }

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

  async dealerTurn() {
    this.status = "DEALER_TURN";

    this.io.to(this.roomId).emit("dealer-reveal", {
      hand: this.dealerHand,
      value: calculateHandValue(this.dealerHand),
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

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

    await this.resolveRound();
  }

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

      await this.updatePlayerStats(player.userId, result, payout - player.bet);
    }

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

    await this.saveRound(results);

    // Sincronizar balances con la API después de guardar la ronda
    await this.syncBalancesToAPI(results);

    // Sincronizar datos del juego y rankings a main-app
    await this.syncToMainApp(results);

    await publishEvent("game.round.completed", {
      roomId: this.roomId,
      roundNumber: this.roundNumber,
      results,
    });

    // Iniciar nueva ronda solo si hay 2+ jugadores
    setTimeout(async () => {
      if (this.players.size >= 2) {
        this.startBettingPhase();
      } else {
        logger.info(`Not enough players, returning to WAITING`);
        this.status = "WAITING";

        // If no players left, finalize the game session so the room can be reused
        if (this.players.size === 0) {
          try {
            if (this.gameSessionId) {
              await this.endGame();
              this.gameSessionId = null;
              logger.info(
                `Game session for room ${this.roomId} ended and cleared (post-round)`
              );
            }
          } catch (err) {
            logger.error("Error ending game session after round:", err);
          }
        }
      }
    }, 10000);
  }

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
      bet: p.bet || 0,
      hand: p.hand || [],
      isStanding: p.isStanding || false,
      isBusted: p.isBusted || false,
      isBlackjack: p.isBlackjack || false,
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

  /**
   * Sincroniza los balances actualizados con la API de autenticación
   * Usa reintentos automáticos y regenera token si expira
   */
  async syncBalancesToAPI(results) {
    const maxRetries = 3;

    for (const result of results) {
      let success = false;
      let attemptCount = 0;

      while (!success && attemptCount < maxRetries) {
        try {
          attemptCount++;

          // Obtener headers con token válido (se regenera si es necesario)
          const headers = await serviceTokenManager.getAuthHeaders();

          await axios.put(
            `${AUTH_API_URL}/api/users/balance`,
            {
              userId: result.userId,
              balance: result.balance,
            },
            {
              headers,
              timeout: 5000,
            }
          );

          logger.info(
            `Balance synced for user ${result.userId}: ${result.balance}`
          );
          success = true;
        } catch (error) {
          logger.warn(
            `Failed to sync balance for user ${result.userId} (attempt ${attemptCount}/${maxRetries}):`,
            error.message
          );

          // Si es error de autenticación (401), intentar regenerar token
          if (error.response?.status === 401 && attemptCount < maxRetries) {
            logger.info("Token inválido, intentando regenerar...");
            try {
              await serviceTokenManager.refreshToken();
              // Continuar el loop para reintentar
            } catch (refreshError) {
              logger.error(
                "Error regenerando token de servicio:",
                refreshError.message
              );
              // No es el último reintento, continuar
            }
          }

          // Si es el último reintento, log de error final
          if (attemptCount === maxRetries) {
            logger.error(
              `Failed to sync balance for user ${result.userId} after ${maxRetries} attempts. Balance will sync on next round.`
            );
          }
        }
      }
    }
  }

  /**
   * Sincroniza datos de la partida completada a main-app
   * Guarda el historial y actualiza rankings
   */
  async syncToMainApp(results) {
    try {
      // Obtener datos de la sesión y sesiones de jugadores
      const session = await prisma.gameSession.findUnique({
        where: { id: this.gameSessionId },
        include: { players: true },
      });

      if (!session) {
        logger.error("Game session not found for sync");
        return false;
      }

      // Mapear datos de jugadores desde players
      const playerData = {};
      for (const playerSession of session.players) {
        playerData[playerSession.userId] = {
          initialBalance: playerSession.initialBalance,
          currentBalance: playerSession.currentBalance,
          roundsWon: playerSession.roundsWon || 0,
          roundsLost: playerSession.roundsLost || 0,
          roundsPush: playerSession.roundsPush || 0,
        };
      }

      // Preparar datos del historial
      const gameData = {
        roomId: this.roomId,
        gameEngineId: this.gameSessionId,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        totalRounds: this.roundNumber,
        results: results.map((r) => {
          const pData = playerData[r.userId] || {};
          return {
            userId: r.userId,
            username: r.username,
            initialBalance: pData.initialBalance || 0,
            balance: r.balance,
            roundsWon: pData.roundsWon,
            roundsLost: pData.roundsLost,
            roundsPush: pData.roundsPush,
          };
        }),
      };

      // Preparar datos de rankings
      const rankingData = {
        results: results.map((r) => {
          const pData = playerData[r.userId] || {};
          return {
            userId: r.userId,
            username: r.username,
            profit: r.balance - (pData.initialBalance || 0),
            roundsWon: pData.roundsWon,
            roundsLost: pData.roundsLost,
          };
        }),
      };

      // Enviar ambos a main-app
      const syncResult = await MainAppSyncService.syncGameCompletion(
        gameData,
        rankingData
      );

      if (syncResult.allSuccess) {
        logger.info(
          `Game completion synced to main-app: ${this.gameSessionId}`
        );
        return true;
      } else {
        logger.warn(
          `Partial sync to main-app: history=${syncResult.historySuccess}, rankings=${syncResult.rankingSuccess}`
        );
        return syncResult.historySuccess; // Al menos el historial es crítico
      }
    } catch (error) {
      logger.error("Error syncing to main-app:", error);
      return false;
    }
  }
}
