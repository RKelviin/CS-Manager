import type { BotPlayer as MockBotPlayer } from "../../shared/mvpMock";

export type BotPlayer = MockBotPlayer & {
  kills?: number;
  deaths?: number;
  assists?: number;
};

export type UserTeam = {
  name: string;
  record: { wins: number; losses: number };
  starters: BotPlayer[];
  bench: BotPlayer[];
};
