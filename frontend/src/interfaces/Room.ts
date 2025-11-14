export interface Room {
  name: string;
  isPublic: boolean;
  password?: string;
  maxPlayers?: number;
  minBet?: number;
  maxBet?: number;
}
