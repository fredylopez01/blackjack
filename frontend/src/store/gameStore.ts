import { create } from "zustand";

export interface Card {
  suit: string;
  rank: string;
  value: number;
}

export interface Player {
  userId: string;
  username: string;
  hand: Card[];
  bet: number;
  balance: number;
  isStanding: boolean;
  isBusted: boolean;
  isBlackjack: boolean;
}

interface GameState {
  roomId: string | null;
  status:
    | "WAITING"
    | "BETTING"
    | "DEALING"
    | "PLAYING"
    | "DEALER_TURN"
    | "FINISHED";
  roundNumber: number;
  players: Player[];
  dealerHand: Card[];
  dealerValue: number;
  currentPlayerTurn: string | null;
  myHand: Card[];
  myBet: number;
  minBet: number;
  maxBet: number;

  // Actions
  setRoomId: (roomId: string) => void;
  setGameStatus: (status: GameState["status"]) => void;
  setRoundNumber: (round: number) => void;
  setPlayers: (players: Player[]) => void;
  setDealerHand: (hand: Card[], value: number) => void;
  setCurrentPlayerTurn: (userId: string | null) => void;
  setMyHand: (hand: Card[]) => void;
  setMyBet: (bet: number) => void;
  setBetLimits: (min: number, max: number) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  roomId: null,
  status: "WAITING",
  roundNumber: 0,
  players: [],
  dealerHand: [],
  dealerValue: 0,
  currentPlayerTurn: null,
  myHand: [],
  myBet: 0,
  minBet: 10,
  maxBet: 1000,

  setRoomId: (roomId) => set({ roomId }),

  setGameStatus: (status) => set({ status }),

  setRoundNumber: (roundNumber) => set({ roundNumber }),

  setPlayers: (players) => set({ players }),

  setDealerHand: (hand, value) => set({ dealerHand: hand, dealerValue: value }),

  setCurrentPlayerTurn: (userId) => set({ currentPlayerTurn: userId }),

  setMyHand: (hand) => set({ myHand: hand }),

  setMyBet: (bet) => set({ myBet: bet }),

  setBetLimits: (min, max) => set({ minBet: min, maxBet: max }),

  resetGame: () =>
    set({
      status: "WAITING",
      roundNumber: 0,
      players: [],
      dealerHand: [],
      dealerValue: 0,
      currentPlayerTurn: null,
      myHand: [],
      myBet: 0,
    }),
}));
