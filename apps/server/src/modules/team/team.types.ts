export type CreateTeamBody = {
  name: string;
};

export type UpdateTeamBody = {
  name?: string;
  wins?: number;
  losses?: number;
};

export type CreatePlayerBody = {
  name: string;
  role: "Sniper" | "Entry" | "Support" | "Lurker" | "IGL";
  aim: number;
  reflex: number;
  decision: number;
  composure: number;
  isStarter?: boolean;
  nationality?: string;
  avatarUrl?: string;
};

export type UpdatePlayerBody = Partial<CreatePlayerBody> & {
  sortOrder?: number;
};
