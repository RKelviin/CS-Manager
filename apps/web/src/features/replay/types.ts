export type TeamSide = "RED" | "BLU";

/** Qual time (A=RED, B=BLU) comeca como CT no 1.º half. O outro comeca TR. */
export type StartsAsSide = "CT" | "TR";

/** Dados opcionais de jogador para simulação (nome, aim e role) */
export type MatchPlayerData = {
  name: string;
  aim: number;
  role: PlayerRole;
  /** Role para exibição (ex.: Sniper, Entry) — igual à tela de gestão do time */
  displayRole?: string;
  /** País (ISO alpha-2) para bandeira no HUD */
  nationality?: string;
  /** Reflexo 0–100: velocidade de reação */
  reflex?: number;
  /** Decisão 0–100: qualidade das escolhas táticas */
  decision?: number;
  /** Composure 0–100: performance sob pressão */
  composure?: number;
};

/** Tipo de partida: tournament/league = ranking + overtime; friendly = sem OT, pode empatar. */
export type MatchType = "tournament" | "friendly";

/** Configuracao da partida: nomes dos times, jogadores e qual comeca como CT. */
export type MatchSetup = {
  teamAName: string;
  teamBName: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  /** Time A (RED) comeca como CT ou TR. Default TR. */
  teamAStartsAs: StartsAsSide;
  /** Opcional: atributos dos jogadores do time A (RED). Se 5 itens, sobrescreve aim/role. */
  teamAPlayerData?: MatchPlayerData[];
  /** Opcional: atributos dos jogadores do time B (BLU). Se 5 itens, sobrescreve aim/role. */
  teamBPlayerData?: MatchPlayerData[];
  /** Mapa da partida (se ausente, usa Dust2) */
  mapData?: import("./map/mapTypes").MapData;
  /** tournament = ranking + overtime 4 rounds; friendly = sem OT (default) */
  matchType?: MatchType;
};

/** Papel tatico (HUD + IA) */
export type PlayerRole = "IGL" | "Rifler" | "AWP";

/** Colete / colete+cap (reduz dano recebido) */
export type ArmorLoadout = "none" | "vest" | "vest_helmet";

export type RedStrategy = "rush" | "split" | "slow" | "default" | "fake";
/** CT: default=3-2, stack-a/b=todos em um site, aggressive=push, hold=âncoras, retake=pós-plant */
export type BluStrategy = "default" | "stack-a" | "stack-b" | "aggressive" | "hold" | "retake" | "rotate";

export type Bot = {
  id: string;
  name: string;
  team: TeamSide;
  role: PlayerRole;
  /** Role para exibição (ex.: Sniper, Entry) — igual à tela de gestão do time */
  displayRole?: string;
  /** País (ISO alpha-2) para bandeira no HUD */
  nationality?: string;
  hp: number;
  x: number;
  y: number;
  angle: number;
  aim: number;
  targetX: number;
  targetY: number;
  lastFireTick: number;
  kills: number;
  deaths: number;
  assists: number;
  /** Total de kills no inicio do round atual (para bonus $ por kill no fim do round) */
  killsAtRoundStart: number;
  /** Kills neste round (resetado ao fim; usado para icones de caveira no HUD) */
  killsThisRound: number;
  /** Dano total causado a inimigos na partida (apos colete) */
  damageDealt: number;
  /** IDs de quem causou dano neste round (para assist no kill) */
  damageContributors: string[];
  /** Moeda do round (visual / futura economia) */
  money: number;
  primaryWeapon: string;
  secondaryWeapon: string;
  /** Apenas time RED; um jogador por round */
  hasBomb: boolean;
  /** CT com kit (visual) */
  hasDefuseKit: boolean;
  /** Protecao corporal (economia + combate) */
  armor: ArmorLoadout;
  /** Ultimo tick em que recebeu dano (-1 = nunca neste round) */
  lastDamageTick: number;
  /** Posicao da origem do ultimo dano (para reacao de mira) */
  lastDamageFromX: number;
  lastDamageFromY: number;
  /** Ultimo tick em que se moveu (para sons de passos — inimigos ouvem) */
  lastMoveTick: number;
  /** Sub-waypoints do grafo de navegacao ate navGoal */
  navPath: { x: number; y: number }[];
  navGoalX: number;
  navGoalY: number;
  /** Ticks preso na parede (recalcula caminho) */
  navStuckTicks: number;
  /** Reflexo 0–100 (default 75) */
  reflex?: number;
  /** Decisão 0–100 (default 75) */
  decision?: number;
  /** Composure 0–100 (default 75) */
  composure?: number;
};

export type MatchScore = {
  RED: number;
  BLU: number;
};

export type MatchState = {
  /** ID único da partida (registry) — usado para assistir em outras telas */
  id?: string;
  /** Nomes dos times (A=RED, B=BLU). Usado na HUD. */
  teamAName: string;
  teamBName: string;
  /** Qual time comeca como CT no 1.º half. */
  teamAStartsAs: StartsAsSide;
  round: number;
  timeLeftMs: number;
  isRunning: boolean;
  tickId: number;
  redStrategy: RedStrategy;
  bluStrategy: BluStrategy;
  score: MatchScore;
  /** OT competitivo: pontuação no período atual (4 rounds). Reset ao iniciar novo período. */
  otPeriodScore?: { RED: number; BLU: number };
  /** Derrotas consecutivas por time (bonus de loss CS-like) */
  lossStreak: { RED: number; BLU: number };
  /** Moral do time 0–100 (afeta composure efetivo sob pressão) */
  morale: { RED: number; BLU: number };
  /** tournament = overtime 4 rounds; friendly = sem OT */
  matchType?: MatchType;
  bots: Bot[];
  logs: string[];
  /** C4 caida no chao (quando o portador morre); null se ninguem pegou */
  bombDroppedAt: { x: number; y: number } | null;
  /** Kits de desarme no chao (CT morto com kit); outro CT pode recolher */
  defuseKitDrops: { x: number; y: number }[];
  /** Primarias largadas no chao (morte); qualquer time pode recolher se for upgrade */
  weaponDrops: { id: string; x: number; y: number; primaryWeapon: string; angle: number }[];
  /** Site alvo da execucao T neste round (portador da bomba) */
  tsExecuteSite: "site-a" | "site-b";
  /** C4 plantada no site */
  bombPlanted: boolean;
  /** Onde a C4 esta plantada (apos plant) */
  bombPlantSite: "site-a" | "site-b" | null;
  /** Posicao exata da C4 no mapa apos plant (defuse = CT em cima) */
  bombPlantWorldPos: { x: number; y: number } | null;
  /** Contagem regressiva ate explosao (apos plant) */
  postPlantTimeLeftMs: number;
  /** Progresso de plant (0 ate completar) enquanto portador no site */
  plantProgressMs: number;
  /** Progresso de defuse no jogador atual */
  defuseProgressMs: number;
  /** Quem esta defusando (id do bot BLU) */
  defuserId: string | null;
  /** Partida encerrada — time vencedor (null se empate ou partida em andamento) */
  matchWinner: TeamSide | null;
  /** Regulamento 12 rounds terminou 6x6 — sem vencedor (OT ainda nao implementado) */
  matchDraw: boolean;
  /** Overlay pos-fim: ms restantes do pause (5s) */
  postMatchPauseMs: number;
  /** Motivo da vitoria no ultimo round (chave interna do engine) */
  matchEndReason: string | null;
  /** Dados do mapa atual (paredes, zonas, spawns) */
  mapData: import("./map/mapTypes").MapData;
  /** Round normal acabou (partida continua) — exibicao temporaria */
  roundEndBanner: { roundNumber: number; winner: TeamSide; cause: string } | null;
  roundEndBannerMs: number;
  /** Ultimo round resolvido (persiste ate o proximo round) — sempre exibido no HUD */
  lastRoundResult: { roundNumber: number; winner: TeamSide; cause: string } | null;
  /** Se true, ao acabar o banner de intermissao volta isRunning para true */
  pendingResumeAfterRound: boolean;
  /** Apos fim de round: reset do proximo round apos banner; durante o banner a simulacao continua (movimento/plant) */
  pendingRoundAdvance: {
    winner: TeamSide;
    oldBotsSnapshot: Bot[];
    /** Bomba ja plantada no momento em que o round foi decidido (para bonus se plantar nos 5s finais) */
    hadBombPlantedAtResolve: boolean;
  } | null;
};

export type MatchEvent =
  | { type: "TICK"; deltaMs: number }
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "FINISH_ROUND" };
