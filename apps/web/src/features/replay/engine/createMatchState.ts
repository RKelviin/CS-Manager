import { DUST2_MAP } from "../map/dust2Map";
import type { MapData } from "../map/mapTypes";
import type { ArmorLoadout, Bot, MatchState, MatchSetup, RedStrategy, BluStrategy } from "../types";
import { START_MONEY } from "./economyConstants";
import { getCtTeam, getTrTeam } from "./matchConstants";
import { BLU_ROLES, RED_ROLES } from "./roleCombat";

const DEFAULT_RED_NAMES = ["RED-1", "RED-2", "RED-3", "RED-4", "RED-5"];
const DEFAULT_BLU_NAMES = ["BLU-1", "BLU-2", "BLU-3", "BLU-4", "BLU-5"];

/** Pistolas por lado: TR = Glock, CT = USP */
const TR_PISTOL = "Glock-18";
const CT_PISTOL = "USP-S";

const RED_STRATS: RedStrategy[] = ["rush", "split", "slow", "default", "fake"];
const BLU_STRATS: BluStrategy[] = ["default", "stack-a", "stack-b", "aggressive", "rotate"];

const pickStrategy = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const getSiteCenter = (map: MapData, siteId: "site-a" | "site-b") => {
  const z = map.zones.find((z) => z.id === siteId && z.type === "site");
  if (!z) return { x: siteId === "site-a" ? 700 : 100, y: 100 };
  return { x: z.x + z.width / 2, y: z.y + z.height / 2 };
};

const createBots = (setup: MatchSetup, map: MapData, round = 1): Bot[] => {
  const { teamAStartsAs, teamAPlayers, teamBPlayers, teamAPlayerData, teamBPlayerData } = setup;
  const trTeam = getTrTeam(round, teamAStartsAs);
  const ctTeam = getCtTeam(round, teamAStartsAs);
  const redIsTr = trTeam === "RED";
  const bombCarrierIndex = Math.floor(Math.random() * 5);

  const redNames = teamAPlayers.length >= 5 ? teamAPlayers : DEFAULT_RED_NAMES;
  const bluNames = teamBPlayers.length >= 5 ? teamBPlayers : DEFAULT_BLU_NAMES;
  const useRedData = teamAPlayerData && teamAPlayerData.length >= 5;
  const useBluData = teamBPlayerData && teamBPlayerData.length >= 5;

  const red = redNames.slice(0, 5).map((name, index) => {
    const custom = useRedData ? teamAPlayerData![index] : null;
    const spawn = redIsTr ? map.spawnPoints.RED[index] : map.spawnPoints.BLU[index];
    const target = redIsTr ? { x: 400, y: 450 } : { x: 400, y: 150 };
    const pistol = redIsTr ? TR_PISTOL : CT_PISTOL;
    return {
      id: `red-${index}`,
      name: custom?.name ?? name,
      team: "RED" as const,
      role: custom?.role ?? RED_ROLES[index],
      displayRole: custom?.displayRole,
      nationality: custom?.nationality,
      reflex: custom?.reflex ?? 75,
      decision: custom?.decision ?? 75,
      composure: custom?.composure ?? 75,
      hp: 100,
      x: spawn.x,
      y: spawn.y,
      angle: redIsTr ? -Math.PI / 2 : Math.PI / 2,
      aim: custom?.aim ?? 72 + (index % 4) * 3,
      targetX: target.x,
      targetY: target.y,
      lastFireTick: -1,
      kills: 0,
      deaths: 0,
      assists: 0,
      killsAtRoundStart: 0,
      killsThisRound: 0,
      damageDealt: 0,
      damageContributors: [],
      money: START_MONEY,
      primaryWeapon: pistol,
      secondaryWeapon: pistol,
      hasBomb: redIsTr && index === bombCarrierIndex,
      hasDefuseKit: false,
      armor: "none" as ArmorLoadout,
      lastDamageTick: -1,
      lastDamageFromX: 0,
      lastDamageFromY: 0,
      lastMoveTick: -1,
      navPath: [],
      navGoalX: target.x,
      navGoalY: target.y,
      navStuckTicks: 0
    };
  });

  const blu = bluNames.slice(0, 5).map((name, index) => {
    const custom = useBluData ? teamBPlayerData![index] : null;
    const bluIsTr = trTeam === "BLU";
    const spawn = bluIsTr ? map.spawnPoints.RED[index] : map.spawnPoints.BLU[index];
    const target = bluIsTr ? { x: 400, y: 450 } : { x: 400, y: 150 };
    const pistol = bluIsTr ? TR_PISTOL : CT_PISTOL;
    return {
      id: `blu-${index}`,
      name: custom?.name ?? name,
      team: "BLU" as const,
      role: custom?.role ?? BLU_ROLES[index],
      displayRole: custom?.displayRole,
      nationality: custom?.nationality,
      reflex: custom?.reflex ?? 75,
      decision: custom?.decision ?? 75,
      composure: custom?.composure ?? 75,
      hp: 100,
      x: spawn.x,
      y: spawn.y,
      angle: bluIsTr ? -Math.PI / 2 : Math.PI / 2,
      aim: custom?.aim ?? 74 + (index % 4) * 3,
      targetX: target.x,
      targetY: target.y,
      lastFireTick: -1,
      kills: 0,
      deaths: 0,
      assists: 0,
      killsAtRoundStart: 0,
      killsThisRound: 0,
      damageDealt: 0,
      damageContributors: [],
      money: START_MONEY,
      primaryWeapon: pistol,
      secondaryWeapon: pistol,
      hasBomb: bluIsTr && index === bombCarrierIndex,
      hasDefuseKit: !bluIsTr && index === 0,
      armor: "none" as ArmorLoadout,
      lastDamageTick: -1,
      lastDamageFromX: 0,
      lastDamageFromY: 0,
      lastMoveTick: -1,
      navPath: [],
      navGoalX: target.x,
      navGoalY: target.y,
      navStuckTicks: 0
    };
  });

  return [...red, ...blu];
};

const defaultMap = (): MapData => ({ ...DUST2_MAP });

/** Garante estrutura válida do mapa (spawns, walls, zones) */
function ensureMapValid(map: MapData): MapData {
  const walls = map.walls ?? [];
  const zones = map.zones ?? [];
  const width = map.width ?? 800;
  const height = map.height ?? 600;
  const fallbackRed = [
    { x: width / 2 - 80, y: height - 60 },
    { x: width / 2 - 40, y: height - 60 },
    { x: width / 2, y: height - 60 },
    { x: width / 2 + 40, y: height - 60 },
    { x: width / 2 + 80, y: height - 60 }
  ];
  const fallbackBlu = [
    { x: width / 2 - 80, y: 60 },
    { x: width / 2 - 40, y: 60 },
    { x: width / 2, y: 60 },
    { x: width / 2 + 40, y: 60 },
    { x: width / 2 + 80, y: 60 }
  ];
  const red = [...(map.spawnPoints?.RED ?? [])];
  const blu = [...(map.spawnPoints?.BLU ?? [])];
  while (red.length < 5) red.push(fallbackRed[red.length]);
  while (blu.length < 5) blu.push(fallbackBlu[blu.length]);
  return {
    ...map,
    width,
    height,
    walls,
    zones,
    spawnPoints: {
      RED: red.slice(0, 5).map((p, i) => (p?.x != null ? p : fallbackRed[i])),
      BLU: blu.slice(0, 5).map((p, i) => (p?.x != null ? p : fallbackBlu[i]))
    }
  };
}

/** Garante que todos os bots tenham estatisticas zeradas (reset de partida). */
const ensureFreshStats = (bots: Bot[]): Bot[] =>
  bots.map((b) => ({
    ...b,
    kills: 0,
    deaths: 0,
    assists: 0,
    killsAtRoundStart: 0,
    killsThisRound: 0,
    damageDealt: 0,
    damageContributors: []
  }));

const defaultSetup: MatchSetup = {
  teamAName: "RED",
  teamBName: "BLU",
  teamAPlayers: DEFAULT_RED_NAMES,
  teamBPlayers: DEFAULT_BLU_NAMES,
  teamAStartsAs: "TR"
};

/** Cria estado inicial. Aceita setup ou estado anterior (para reset preservando config). fullReset=true ignora score/round do init. */
export const createMatchState = (
  init?: Partial<MatchState> | MatchSetup,
  options?: { fullReset?: boolean }
): MatchState => {
  const fullReset = options?.fullReset ?? false;
  const rawMap: MapData =
    (init && "mapData" in init && (init as { mapData?: MapData }).mapData) || defaultMap();
  const map = ensureMapValid(rawMap);
  const setup: MatchSetup =
    init && "teamAPlayers" in init
      ? (init as MatchSetup)
      : init && "teamAName" in init && "bots" in init
        ? (() => {
            const st = init as MatchState;
            const redBots = st.bots.filter((b) => b.team === "RED");
            const bluBots = st.bots.filter((b) => b.team === "BLU");
            return {
              teamAName: st.teamAName,
              teamBName: st.teamBName,
              teamAPlayers: redBots.map((b) => b.name),
              teamBPlayers: bluBots.map((b) => b.name),
              teamAStartsAs: st.teamAStartsAs,
              mapData: st.mapData,
              matchType: st.matchType,
              teamAPlayerData: redBots.map((b) => ({
                name: b.name,
                aim: b.aim,
                role: b.role,
                displayRole: b.displayRole,
                nationality: b.nationality,
                reflex: b.reflex,
                decision: b.decision,
                composure: b.composure
              })),
              teamBPlayerData: bluBots.map((b) => ({
                name: b.name,
                aim: b.aim,
                role: b.role,
                displayRole: b.displayRole,
                nationality: b.nationality,
                reflex: b.reflex,
                decision: b.decision,
                composure: b.composure
              }))
            };
          })()
        : defaultSetup;

  const round = init && "round" in init && "bots" in init ? (init as MatchState).round : 1;
  const matchType = setup.matchType ?? "friendly";
  const redStrategy = pickStrategy(RED_STRATS);
  const tsExecuteSite = Math.random() < 0.5 ? "site-a" : "site-b";
  const bluStrategy: BluStrategy = "default";
  const siteLabel = tsExecuteSite === "site-a" ? "A" : "B";
  const sitePos = getSiteCenter(map, tsExecuteSite);
  const trLabel = setup.teamAStartsAs === "TR" ? setup.teamAName : setup.teamBName;
  const ctLabel = setup.teamAStartsAs === "TR" ? setup.teamBName : setup.teamAName;

  return {
    teamAName: setup.teamAName,
    teamBName: setup.teamBName,
    teamAStartsAs: setup.teamAStartsAs,
    mapData: map,
    round: fullReset || !(init && "round" in init) ? 1 : (init as MatchState).round,
    timeLeftMs: 115000,
    isRunning: false,
    tickId: 0,
    redStrategy,
    bluStrategy,
    score: fullReset || !(init && "score" in init) ? { RED: 0, BLU: 0 } : { ...(init as MatchState).score },
    lossStreak: fullReset || !(init && "lossStreak" in init) ? { RED: 0, BLU: 0 } : { ...(init as MatchState).lossStreak },
    morale:
      fullReset || !(init && "morale" in init && "bots" in init)
        ? { RED: 100, BLU: 100 }
        : { ...(init as MatchState).morale },
    matchType,
    otPeriodScore: fullReset ? undefined : (init && "otPeriodScore" in init ? { ...(init as MatchState).otPeriodScore! } : undefined),
    bots: ensureFreshStats(createBots(setup, map, round)),
    bombDroppedAt: null,
    defuseKitDrops: [],
    weaponDrops: [],
    tsExecuteSite,
    bombPlanted: false,
    bombPlantSite: null,
    bombPlantWorldPos: null,
    postPlantTimeLeftMs: 0,
    plantProgressMs: 0,
    defuseProgressMs: 0,
    defuserId: null,
    matchWinner: null,
    matchDraw: false,
    postMatchPauseMs: 0,
    matchEndReason: null,
    roundEndBanner: null,
    roundEndBannerMs: 0,
    lastRoundResult: null,
    pendingResumeAfterRound: false,
    pendingRoundAdvance: null,
    logs: [
      `${setup.teamAName} ${redStrategy} | ${setup.teamBName} ${bluStrategy}`,
      `Execucao ${trLabel}: site ${siteLabel} (~${Math.round(sitePos.x)}, ${Math.round(sitePos.y)})`,
      `${ctLabel} comeca como CT · ${trLabel} como TR · meio-tempo no round 7.`,
      "Partida pronta. Clique em Iniciar partida para simular."
    ]
  };
};
