export interface GameResult {
  userId: string;
  username: string;
  profit: number;
  roundsWon: number;
  roundsLost: number;
  roundsPush: number;
  finalBalance: number;
}

export interface GameHistoryRecord {
  id: string;
  roomId: string;
  gameEngineId: string;
  startedAt: string;
  finishedAt: string;
  totalRounds: number;
  playersCount: number;
  results: GameResult[];
}
