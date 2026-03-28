/** Modelo de 4 atributos: Precisão, Reflexo, Inteligência, Composure. Total = média dos 4. */
export type BotPlayer = {
  id: string;
  name: string;
  role: "Sniper" | "Entry" | "Support" | "Lurker" | "IGL";
  /** Precisão (0–100): chance de acerto */
  aim: number;
  /** Reflexo (0–100): reação e rotação da mira */
  reflex: number;
  /** Inteligência (0–100): decisões táticas, escolha de alvo */
  decision: number;
  /** Composure (0–100): performance sob pressão */
  composure: number;
  isStarter: boolean;
  price?: number;
  /** URL de imagem personalizada (opcional); se ausente, usa placeholder por id */
  avatarUrl?: string;
  /** Código ISO 3166-1 alpha-2 do país (ex: BR, US) para exibir bandeira */
  nationality?: string;
};

/** Pontuação total = média dos 4 atributos principais */
export const getPlayerTotal = (p: Pick<BotPlayer, "aim" | "reflex" | "decision" | "composure">) =>
  Math.round((p.aim + p.reflex + p.decision + p.composure) / 4);

export type MatchItem = {
  id: string;
  round: number;
  teamA: string;
  teamB: string;
  winner?: string;
  status: "scheduled" | "finished";
};

export type BetItem = {
  id: string;
  match: string;
  picked: string;
  amount: number;
  payout: number;
  status: "open" | "won" | "lost";
};

export const userProfile = {
  name: "Manager Rookie",
  email: "manager@csm.local",
  walletBalance: 1000
};

export const userTeam = {
  name: "Dust Hunters",
  record: { wins: 2, losses: 1 },
  starters: [
    { id: "p1", name: "Kite", role: "Entry", aim: 79, reflex: 82, decision: 70, composure: 68, isStarter: true, nationality: "BR" },
    { id: "p2", name: "Vex", role: "Sniper", aim: 86, reflex: 80, decision: 77, composure: 79, isStarter: true, nationality: "US" },
    { id: "p3", name: "Mako", role: "Support", aim: 73, reflex: 71, decision: 83, composure: 80, isStarter: true, nationality: "DK" },
    { id: "p4", name: "Rune", role: "Lurker", aim: 75, reflex: 78, decision: 74, composure: 77, isStarter: true, nationality: "SE" },
    { id: "p5", name: "Sage", role: "IGL", aim: 68, reflex: 69, decision: 89, composure: 85, isStarter: true, nationality: "PL" }
  ] as BotPlayer[],
  bench: [
    { id: "p6", name: "Nox", role: "Entry", aim: 70, reflex: 73, decision: 66, composure: 65, isStarter: false, nationality: "FR" },
    { id: "p7", name: "Pixel", role: "Support", aim: 66, reflex: 68, decision: 74, composure: 72, isStarter: false, nationality: "DE" },
    { id: "p8", name: "Titan", role: "Sniper", aim: 92, reflex: 91, decision: 88, composure: 90, isStarter: false, nationality: "RU" },
    { id: "p9", name: "Nova", role: "Support", aim: 84, reflex: 82, decision: 80, composure: 85, isStarter: false, nationality: "SE" },
    { id: "p10", name: "Spike", role: "Entry", aim: 78, reflex: 76, decision: 72, composure: 74, isStarter: false, nationality: "BR" },
    { id: "p11", name: "Ghost", role: "Lurker", aim: 72, reflex: 74, decision: 76, composure: 71, isStarter: false, nationality: "UA" },
    { id: "p12", name: "Cipher", role: "IGL", aim: 65, reflex: 64, decision: 82, composure: 78, isStarter: false, nationality: "DK" },
    { id: "p13", name: "Rust", role: "Entry", aim: 58, reflex: 62, decision: 55, composure: 58, isStarter: false, nationality: "PL" },
    { id: "p14", name: "Dust", role: "Support", aim: 48, reflex: 52, decision: 55, composure: 50, isStarter: false, nationality: "PT" },
    { id: "p15", name: "Zero", role: "Lurker", aim: 42, reflex: 45, decision: 48, composure: 44, isStarter: false, nationality: "TR" }
  ] as BotPlayer[]
};

export const marketPlayers: BotPlayer[] = [
  { id: "m1", name: "Ares", role: "Entry", aim: 80, reflex: 81, decision: 67, composure: 66, isStarter: false, price: 230, nationality: "BR" },
  { id: "m2", name: "Echo", role: "Support", aim: 71, reflex: 70, decision: 82, composure: 79, isStarter: false, price: 210, nationality: "UA" },
  { id: "m3", name: "Blitz", role: "Sniper", aim: 88, reflex: 76, decision: 74, composure: 82, isStarter: false, price: 300, nationality: "RU" },
  { id: "m4", name: "Jett", role: "Lurker", aim: 78, reflex: 80, decision: 71, composure: 70, isStarter: false, price: 240, nationality: "KR" },
  { id: "m5", name: "Torque", role: "IGL", aim: 65, reflex: 64, decision: 91, composure: 88, isStarter: false, price: 260, nationality: "PL" },
  { id: "m6", name: "Raze", role: "Entry", aim: 77, reflex: 79, decision: 69, composure: 67, isStarter: false, price: 220, nationality: "PT" },
  { id: "m7", name: "Nova", role: "Support", aim: 72, reflex: 74, decision: 79, composure: 78, isStarter: false, price: 225, nationality: "SE" },
  { id: "m8", name: "Drift", role: "Lurker", aim: 76, reflex: 75, decision: 73, composure: 74, isStarter: false, price: 235, nationality: "AU" },
  { id: "m9", name: "Bolt", role: "Sniper", aim: 84, reflex: 77, decision: 72, composure: 80, isStarter: false, price: 280, nationality: "CA" },
  { id: "m10", name: "Atlas", role: "IGL", aim: 67, reflex: 66, decision: 87, composure: 83, isStarter: false, price: 245, nationality: "DK" },
  { id: "m11", name: "Viper", role: "Entry", aim: 82, reflex: 85, decision: 64, composure: 62, isStarter: false, price: 255, nationality: "US" },
  { id: "m12", name: "Reaper", role: "Sniper", aim: 91, reflex: 84, decision: 78, composure: 86, isStarter: false, price: 320, nationality: "SE" },
  { id: "m13", name: "Phoenix", role: "Support", aim: 74, reflex: 72, decision: 85, composure: 81, isStarter: false, price: 235, nationality: "ES" },
  { id: "m14", name: "Shadow", role: "Lurker", aim: 79, reflex: 77, decision: 75, composure: 74, isStarter: false, price: 250, nationality: "DE" },
  { id: "m15", name: "Onyx", role: "IGL", aim: 63, reflex: 61, decision: 93, composure: 90, isStarter: false, price: 270, nationality: "FI" },
  { id: "m16", name: "Flare", role: "Entry", aim: 81, reflex: 83, decision: 68, composure: 65, isStarter: false, price: 248, nationality: "FR" },
  { id: "m17", name: "Storm", role: "Support", aim: 70, reflex: 73, decision: 80, composure: 76, isStarter: false, price: 218, nationality: "NO" },
  { id: "m18", name: "Cipher", role: "Lurker", aim: 77, reflex: 79, decision: 76, composure: 72, isStarter: false, price: 238, nationality: "CZ" },
  { id: "m19", name: "Pulse", role: "Sniper", aim: 86, reflex: 80, decision: 73, composure: 78, isStarter: false, price: 285, nationality: "IL" },
  { id: "m20", name: "Nexus", role: "IGL", aim: 66, reflex: 65, decision: 88, composure: 86, isStarter: false, price: 255, nationality: "DK" },
  { id: "m21", name: "Frost", role: "Entry", aim: 75, reflex: 78, decision: 70, composure: 68, isStarter: false, price: 225, nationality: "RU" },
  { id: "m22", name: "Ember", role: "Support", aim: 69, reflex: 71, decision: 84, composure: 80, isStarter: false, price: 228, nationality: "GB" },
  { id: "m23", name: "Rogue", role: "Lurker", aim: 73, reflex: 75, decision: 78, composure: 71, isStarter: false, price: 232, nationality: "TR" },
  { id: "m24", name: "Zenith", role: "Sniper", aim: 89, reflex: 82, decision: 76, composure: 84, isStarter: false, price: 295, nationality: "AU" },
  { id: "m25", name: "Orbit", role: "IGL", aim: 64, reflex: 63, decision: 90, composure: 87, isStarter: false, price: 262, nationality: "PL" },
  { id: "m26", name: "Blaze", role: "Entry", aim: 83, reflex: 84, decision: 66, composure: 64, isStarter: false, price: 258, nationality: "BR" },
  { id: "m27", name: "Haze", role: "Support", aim: 68, reflex: 69, decision: 83, composure: 77, isStarter: false, price: 215, nationality: "UA" },
  { id: "m28", name: "Prism", role: "Lurker", aim: 80, reflex: 78, decision: 72, composure: 73, isStarter: false, price: 252, nationality: "KR" },
  { id: "m29", name: "Titan", role: "Sniper", aim: 90, reflex: 88, decision: 85, composure: 89, isStarter: false, price: 340, nationality: "RU" },
  { id: "m30", name: "Vortex", role: "IGL", aim: 62, reflex: 60, decision: 92, composure: 91, isStarter: false, price: 265, nationality: "SE" },
  { id: "m31", name: "Cobra", role: "Entry", aim: 78, reflex: 81, decision: 69, composure: 67, isStarter: false, price: 242, nationality: "PT" },
  { id: "m32", name: "Lynx", role: "Support", aim: 72, reflex: 74, decision: 81, composure: 79, isStarter: false, price: 230, nationality: "CA" },
  { id: "m33", name: "Mantis", role: "Lurker", aim: 74, reflex: 76, decision: 77, composure: 70, isStarter: false, price: 228, nationality: "DE" },
  { id: "m34", name: "Hawk", role: "Sniper", aim: 87, reflex: 79, decision: 74, composure: 81, isStarter: false, price: 290, nationality: "US" },
  { id: "m35", name: "Alpha", role: "IGL", aim: 68, reflex: 67, decision: 86, composure: 84, isStarter: false, price: 258, nationality: "FR" },
  { id: "m36", name: "Razor", role: "Entry", aim: 84, reflex: 86, decision: 65, composure: 63, isStarter: false, price: 268, nationality: "BR" },
  { id: "m37", name: "Slate", role: "Support", aim: 67, reflex: 68, decision: 86, composure: 82, isStarter: false, price: 222, nationality: "ES" },
  { id: "m38", name: "Ghost", role: "Lurker", aim: 76, reflex: 77, decision: 74, composure: 72, isStarter: false, price: 236, nationality: "PL" },
  { id: "m39", name: "Arrow", role: "Sniper", aim: 85, reflex: 81, decision: 75, composure: 79, isStarter: false, price: 278, nationality: "DK" },
  { id: "m40", name: "Prime", role: "IGL", aim: 69, reflex: 68, decision: 89, composure: 85, isStarter: false, price: 260, nationality: "FI" },
  { id: "m41", name: "Scout", role: "Entry", aim: 76, reflex: 79, decision: 71, composure: 69, isStarter: false, price: 232, nationality: "NO" },
  { id: "m42", name: "Haven", role: "Support", aim: 71, reflex: 70, decision: 82, composure: 78, isStarter: false, price: 220, nationality: "CZ" },
  { id: "m43", name: "Dusk", role: "Lurker", aim: 75, reflex: 74, decision: 76, composure: 73, isStarter: false, price: 234, nationality: "IL" },
  { id: "m44", name: "Strike", role: "Sniper", aim: 83, reflex: 78, decision: 70, composure: 77, isStarter: false, price: 272, nationality: "TR" },
  { id: "m45", name: "Apex", role: "IGL", aim: 70, reflex: 69, decision: 84, composure: 83, isStarter: false, price: 248, nationality: "AU" },
  { id: "m46", name: "Omen", role: "Sniper", aim: 94, reflex: 91, decision: 87, composure: 90, isStarter: false, price: 420, nationality: "DK" },
  { id: "m47", name: "Fury", role: "Entry", aim: 92, reflex: 93, decision: 86, composure: 89, isStarter: false, price: 400, nationality: "BR" },
  { id: "m48", name: "Spectre", role: "IGL", aim: 88, reflex: 86, decision: 94, composure: 94, isStarter: false, price: 430, nationality: "SE" },
  { id: "m49", name: "Inferno", role: "Lurker", aim: 91, reflex: 90, decision: 89, composure: 91, isStarter: false, price: 410, nationality: "RU" },
  { id: "m50", name: "Seraph", role: "Support", aim: 89, reflex: 88, decision: 93, composure: 92, isStarter: false, price: 415, nationality: "FI" }
];

export const seasonMatches: MatchItem[] = [
  { id: "s1", round: 1, teamA: "Dust Hunters", teamB: "Mid Raiders", winner: "Dust Hunters", status: "finished" },
  { id: "s2", round: 2, teamA: "Long Kings", teamB: "Tunnel Foxes", winner: "Tunnel Foxes", status: "finished" },
  { id: "s3", round: 3, teamA: "Dust Hunters", teamB: "Long Kings", status: "scheduled" },
  { id: "s4", round: 4, teamA: "Mid Raiders", teamB: "Tunnel Foxes", status: "scheduled" },
  { id: "s5", round: 5, teamA: "Dust Hunters", teamB: "Tunnel Foxes", status: "scheduled" },
  { id: "s6", round: 6, teamA: "Mid Raiders", teamB: "Long Kings", status: "scheduled" }
];

/** Partidas já realizadas do time do usuário (para histórico no dashboard). */
export const userTeamMatchHistory: MatchItem[] = [
  { id: "s1", round: 1, teamA: "Dust Hunters", teamB: "Mid Raiders", winner: "Dust Hunters", status: "finished" },
  { id: "u1", round: 2, teamA: "Dust Hunters", teamB: "Long Kings", winner: "Dust Hunters", status: "finished" },
  { id: "u2", round: 3, teamA: "Dust Hunters", teamB: "Tunnel Foxes", winner: "Tunnel Foxes", status: "finished" }
];

/** Desempenho dos jogadores na temporada (K/D/A). Mock por enquanto. */
export const playerSeasonStats: Record<string, { kills: number; deaths: number; assists: number }> = {
  p1: { kills: 42, deaths: 38, assists: 12 },
  p2: { kills: 58, deaths: 31, assists: 8 },
  p3: { kills: 31, deaths: 35, assists: 22 },
  p4: { kills: 39, deaths: 36, assists: 15 },
  p5: { kills: 28, deaths: 40, assists: 18 },
  p6: { kills: 0, deaths: 0, assists: 0 },
  p7: { kills: 0, deaths: 0, assists: 0 },
  p8: { kills: 0, deaths: 0, assists: 0 },
  p9: { kills: 0, deaths: 0, assists: 0 },
  p10: { kills: 0, deaths: 0, assists: 0 },
  p11: { kills: 0, deaths: 0, assists: 0 },
  p12: { kills: 0, deaths: 0, assists: 0 },
  p13: { kills: 0, deaths: 0, assists: 0 },
  p14: { kills: 0, deaths: 0, assists: 0 },
  p15: { kills: 0, deaths: 0, assists: 0 }
};

export const ranking = [
  { team: "Dust Hunters", points: 6, wins: 2, losses: 1 },
  { team: "Tunnel Foxes", points: 3, wins: 1, losses: 1 },
  { team: "Long Kings", points: 0, wins: 0, losses: 1 },
  { team: "Mid Raiders", points: 0, wins: 0, losses: 1 }
];

export const bets: BetItem[] = [
  { id: "b1", match: "Dust Hunters vs Mid Raiders", picked: "Dust Hunters", amount: 120, payout: 210, status: "won" },
  { id: "b2", match: "Long Kings vs Tunnel Foxes", picked: "Long Kings", amount: 80, payout: 0, status: "lost" },
  { id: "b3", match: "Dust Hunters vs Long Kings", picked: "Dust Hunters", amount: 150, payout: 0, status: "open" }
];
