/** Types for API responses - match Prisma/backend shapes */
export type ApiPlayer = {
  id: string;
  teamId: string;
  name: string;
  role: "Sniper" | "Entry" | "Support" | "Lurker" | "IGL";
  aim: number;
  reflex: number;
  decision: number;
  composure: number;
  isStarter: boolean;
  nationality: string | null;
  avatarUrl: string | null;
  sortOrder: number;
};

export type ApiTeam = {
  id: string;
  userId: string;
  name: string;
  wins: number;
  losses: number;
  players: ApiPlayer[];
};
