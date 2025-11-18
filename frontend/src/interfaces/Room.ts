export interface Room {
  id?: string;
  name: string;
  isPublic: boolean;
  password?: string;
  maxPlayers?: number;
  minBet?: number;
  maxBet?: number;
  status?: string;
  createdAt?: string;
  createdBy?: string;
}
