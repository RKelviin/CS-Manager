import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { persistMatchResult } from "../modules/simulation/simulation.service.js";

const prisma = new PrismaClient();

type Role = "Sniper" | "Entry" | "Support" | "Lurker" | "IGL";

const SYSTEM_USER_EMAIL = "system@csm.league";

/** Times NPC da liga com 5 jogadores cada (role: Entry, Sniper, Support, Lurker, IGL) */
const NPC_TEAMS: Array<{
  name: string;
  players: Array<{ name: string; role: Role; aim: number; reflex: number; decision: number; composure: number; nationality: string }>;
}> = [
  {
    name: "Tunnel Foxes",
    players: [
      { name: "Raze", role: "Entry", aim: 77, reflex: 79, decision: 69, composure: 67, nationality: "PT" },
      { name: "Bolt", role: "Sniper", aim: 84, reflex: 77, decision: 72, composure: 80, nationality: "CA" },
      { name: "Storm", role: "Support", aim: 70, reflex: 73, decision: 80, composure: 76, nationality: "NO" },
      { name: "Drift", role: "Lurker", aim: 76, reflex: 75, decision: 73, composure: 74, nationality: "AU" },
      { name: "Nexus", role: "IGL", aim: 66, reflex: 65, decision: 88, composure: 86, nationality: "DK" }
    ]
  },
  {
    name: "Long Kings",
    players: [
      { name: "Viper", role: "Entry", aim: 82, reflex: 85, decision: 64, composure: 62, nationality: "US" },
      { name: "Reaper", role: "Sniper", aim: 91, reflex: 84, decision: 78, composure: 86, nationality: "SE" },
      { name: "Phoenix", role: "Support", aim: 74, reflex: 72, decision: 85, composure: 81, nationality: "ES" },
      { name: "Shadow", role: "Lurker", aim: 79, reflex: 77, decision: 75, composure: 74, nationality: "DE" },
      { name: "Onyx", role: "IGL", aim: 63, reflex: 61, decision: 93, composure: 90, nationality: "FI" }
    ]
  },
  {
    name: "Mid Raiders",
    players: [
      { name: "Blaze", role: "Entry", aim: 83, reflex: 84, decision: 66, composure: 64, nationality: "BR" },
      { name: "Zenith", role: "Sniper", aim: 89, reflex: 82, decision: 76, composure: 84, nationality: "AU" },
      { name: "Haze", role: "Support", aim: 68, reflex: 69, decision: 83, composure: 77, nationality: "UA" },
      { name: "Prism", role: "Lurker", aim: 80, reflex: 78, decision: 72, composure: 73, nationality: "KR" },
      { name: "Vortex", role: "IGL", aim: 62, reflex: 60, decision: 92, composure: 91, nationality: "SE" }
    ]
  },
  {
    name: "Dust Devils",
    players: [
      { name: "Flare", role: "Entry", aim: 81, reflex: 83, decision: 68, composure: 65, nationality: "FR" },
      { name: "Pulse", role: "Sniper", aim: 86, reflex: 80, decision: 73, composure: 78, nationality: "IL" },
      { name: "Ember", role: "Support", aim: 69, reflex: 71, decision: 84, composure: 80, nationality: "GB" },
      { name: "Cipher", role: "Lurker", aim: 77, reflex: 79, decision: 76, composure: 72, nationality: "CZ" },
      { name: "Orbit", role: "IGL", aim: 64, reflex: 63, decision: 90, composure: 87, nationality: "PL" }
    ]
  },
  {
    name: "Neon Rush",
    players: [
      { name: "Razor", role: "Entry", aim: 84, reflex: 86, decision: 65, composure: 63, nationality: "BR" },
      { name: "Hawk", role: "Sniper", aim: 87, reflex: 79, decision: 74, composure: 81, nationality: "US" },
      { name: "Slate", role: "Support", aim: 67, reflex: 68, decision: 86, composure: 82, nationality: "ES" },
      { name: "Ghost", role: "Lurker", aim: 76, reflex: 77, decision: 74, composure: 72, nationality: "PL" },
      { name: "Prime", role: "IGL", aim: 69, reflex: 68, decision: 89, composure: 85, nationality: "FI" }
    ]
  },
  {
    name: "Phantom Squad",
    players: [
      { name: "Scout", role: "Entry", aim: 76, reflex: 79, decision: 71, composure: 69, nationality: "NO" },
      { name: "Arrow", role: "Sniper", aim: 85, reflex: 81, decision: 75, composure: 79, nationality: "DK" },
      { name: "Haven", role: "Support", aim: 71, reflex: 70, decision: 82, composure: 78, nationality: "CZ" },
      { name: "Dusk", role: "Lurker", aim: 75, reflex: 74, decision: 76, composure: 73, nationality: "IL" },
      { name: "Apex", role: "IGL", aim: 70, reflex: 69, decision: 84, composure: 83, nationality: "AU" }
    ]
  },
  {
    name: "Steel Legion",
    players: [
      { name: "Blade", role: "Entry", aim: 83, reflex: 85, decision: 65, composure: 63, nationality: "SK" },
      { name: "Scope", role: "Sniper", aim: 88, reflex: 81, decision: 74, composure: 82, nationality: "HU" },
      { name: "Cove", role: "Support", aim: 70, reflex: 71, decision: 83, composure: 80, nationality: "HR" },
      { name: "Shade", role: "Lurker", aim: 75, reflex: 77, decision: 76, composure: 71, nationality: "LT" },
      { name: "Chief", role: "IGL", aim: 66, reflex: 64, decision: 88, composure: 85, nationality: "LV" }
    ]
  },
  {
    name: "Void Hunters",
    players: [
      { name: "Rush", role: "Entry", aim: 82, reflex: 84, decision: 66, composure: 65, nationality: "EE" },
      { name: "Snipe", role: "Sniper", aim: 87, reflex: 80, decision: 75, composure: 79, nationality: "BY" },
      { name: "Vault", role: "Support", aim: 68, reflex: 69, decision: 84, composure: 81, nationality: "SI" },
      { name: "Lurk", role: "Lurker", aim: 74, reflex: 76, decision: 78, composure: 70, nationality: "MD" },
      { name: "Tact", role: "IGL", aim: 65, reflex: 63, decision: 91, composure: 86, nationality: "AL" }
    ]
  },
  {
    name: "Apex Force",
    players: [
      { name: "Gale", role: "Entry", aim: 78, reflex: 80, decision: 70, composure: 68, nationality: "GE" },
      { name: "Lens", role: "Sniper", aim: 89, reflex: 82, decision: 76, composure: 83, nationality: "IS" },
      { name: "Mend", role: "Support", aim: 72, reflex: 73, decision: 80, composure: 79, nationality: "LU" },
      { name: "Fade", role: "Lurker", aim: 73, reflex: 75, decision: 77, composure: 71, nationality: "CY" },
      { name: "Call", role: "IGL", aim: 69, reflex: 67, decision: 86, composure: 84, nationality: "MT" }
    ]
  }
];

const TEMPLATES: Array<{ name: string; role: Role; aim: number; reflex: number; decision: number; composure: number; nationality: string; price: number }> = [
  { name: "Ares", role: "Entry", aim: 80, reflex: 81, decision: 67, composure: 66, nationality: "BR", price: 230 },
  { name: "Echo", role: "Support", aim: 71, reflex: 70, decision: 82, composure: 79, nationality: "UA", price: 210 },
  { name: "Blitz", role: "Sniper", aim: 88, reflex: 76, decision: 74, composure: 82, nationality: "RU", price: 300 },
  { name: "Jett", role: "Lurker", aim: 78, reflex: 80, decision: 71, composure: 70, nationality: "KR", price: 240 },
  { name: "Torque", role: "IGL", aim: 65, reflex: 64, decision: 91, composure: 88, nationality: "PL", price: 260 },
  { name: "Raze", role: "Entry", aim: 77, reflex: 79, decision: 69, composure: 67, nationality: "PT", price: 220 },
  { name: "Nova", role: "Support", aim: 72, reflex: 74, decision: 79, composure: 78, nationality: "SE", price: 225 },
  { name: "Drift", role: "Lurker", aim: 76, reflex: 75, decision: 73, composure: 74, nationality: "AU", price: 235 },
  { name: "Bolt", role: "Sniper", aim: 84, reflex: 77, decision: 72, composure: 80, nationality: "CA", price: 280 },
  { name: "Atlas", role: "IGL", aim: 67, reflex: 66, decision: 87, composure: 83, nationality: "DK", price: 245 },
  { name: "Viper", role: "Entry", aim: 82, reflex: 85, decision: 64, composure: 62, nationality: "US", price: 255 },
  { name: "Reaper", role: "Sniper", aim: 91, reflex: 84, decision: 78, composure: 86, nationality: "SE", price: 320 },
  { name: "Phoenix", role: "Support", aim: 74, reflex: 72, decision: 85, composure: 81, nationality: "ES", price: 235 },
  { name: "Shadow", role: "Lurker", aim: 79, reflex: 77, decision: 75, composure: 74, nationality: "DE", price: 250 },
  { name: "Onyx", role: "IGL", aim: 63, reflex: 61, decision: 93, composure: 90, nationality: "FI", price: 270 },
  { name: "Flare", role: "Entry", aim: 81, reflex: 83, decision: 68, composure: 65, nationality: "FR", price: 248 },
  { name: "Storm", role: "Support", aim: 70, reflex: 73, decision: 80, composure: 76, nationality: "NO", price: 218 },
  { name: "Cipher", role: "Lurker", aim: 77, reflex: 79, decision: 76, composure: 72, nationality: "CZ", price: 238 },
  { name: "Pulse", role: "Sniper", aim: 86, reflex: 80, decision: 73, composure: 78, nationality: "IL", price: 285 },
  { name: "Nexus", role: "IGL", aim: 66, reflex: 65, decision: 88, composure: 86, nationality: "DK", price: 255 },
  { name: "Frost", role: "Entry", aim: 75, reflex: 78, decision: 70, composure: 68, nationality: "RU", price: 225 },
  { name: "Ember", role: "Support", aim: 69, reflex: 71, decision: 84, composure: 80, nationality: "GB", price: 228 },
  { name: "Rogue", role: "Lurker", aim: 73, reflex: 75, decision: 78, composure: 71, nationality: "TR", price: 232 },
  { name: "Zenith", role: "Sniper", aim: 89, reflex: 82, decision: 76, composure: 84, nationality: "AU", price: 295 },
  { name: "Orbit", role: "IGL", aim: 64, reflex: 63, decision: 90, composure: 87, nationality: "PL", price: 262 },
  { name: "Blaze", role: "Entry", aim: 83, reflex: 84, decision: 66, composure: 64, nationality: "BR", price: 258 },
  { name: "Haze", role: "Support", aim: 68, reflex: 69, decision: 83, composure: 77, nationality: "UA", price: 215 },
  { name: "Prism", role: "Lurker", aim: 80, reflex: 78, decision: 72, composure: 73, nationality: "KR", price: 252 },
  { name: "Titan", role: "Sniper", aim: 90, reflex: 88, decision: 85, composure: 89, nationality: "RU", price: 340 },
  { name: "Vortex", role: "IGL", aim: 62, reflex: 60, decision: 92, composure: 91, nationality: "SE", price: 265 },
  { name: "Cobra", role: "Entry", aim: 78, reflex: 81, decision: 69, composure: 67, nationality: "PT", price: 242 },
  { name: "Lynx", role: "Support", aim: 72, reflex: 74, decision: 81, composure: 79, nationality: "CA", price: 230 },
  { name: "Mantis", role: "Lurker", aim: 74, reflex: 76, decision: 77, composure: 70, nationality: "DE", price: 228 },
  { name: "Hawk", role: "Sniper", aim: 87, reflex: 79, decision: 74, composure: 81, nationality: "US", price: 290 },
  { name: "Alpha", role: "IGL", aim: 68, reflex: 67, decision: 86, composure: 84, nationality: "FR", price: 258 },
  { name: "Razor", role: "Entry", aim: 84, reflex: 86, decision: 65, composure: 63, nationality: "BR", price: 268 },
  { name: "Slate", role: "Support", aim: 67, reflex: 68, decision: 86, composure: 82, nationality: "ES", price: 222 },
  { name: "Ghost", role: "Lurker", aim: 76, reflex: 77, decision: 74, composure: 72, nationality: "PL", price: 236 },
  { name: "Arrow", role: "Sniper", aim: 85, reflex: 81, decision: 75, composure: 79, nationality: "DK", price: 278 },
  { name: "Prime", role: "IGL", aim: 69, reflex: 68, decision: 89, composure: 85, nationality: "FI", price: 260 },
  { name: "Scout", role: "Entry", aim: 76, reflex: 79, decision: 71, composure: 69, nationality: "NO", price: 232 },
  { name: "Haven", role: "Support", aim: 71, reflex: 70, decision: 82, composure: 78, nationality: "CZ", price: 220 },
  { name: "Dusk", role: "Lurker", aim: 75, reflex: 74, decision: 76, composure: 73, nationality: "IL", price: 234 },
  { name: "Strike", role: "Sniper", aim: 83, reflex: 78, decision: 70, composure: 77, nationality: "TR", price: 272 },
  { name: "Apex", role: "IGL", aim: 70, reflex: 69, decision: 84, composure: 83, nationality: "AU", price: 248 },
  { name: "Omen", role: "Sniper", aim: 94, reflex: 91, decision: 87, composure: 90, nationality: "DK", price: 420 },
  { name: "Fury", role: "Entry", aim: 92, reflex: 93, decision: 86, composure: 89, nationality: "BR", price: 400 },
  { name: "Spectre", role: "IGL", aim: 88, reflex: 86, decision: 94, composure: 94, nationality: "SE", price: 430 },
  { name: "Inferno", role: "Lurker", aim: 91, reflex: 90, decision: 89, composure: 91, nationality: "RU", price: 410 },
  { name: "Seraph", role: "Support", aim: 89, reflex: 88, decision: 93, composure: 92, nationality: "FI", price: 415 },
  // 50 adicionais
  { name: "Kite", role: "Entry", aim: 79, reflex: 82, decision: 70, composure: 68, nationality: "BR", price: 245 },
  { name: "Vex", role: "Sniper", aim: 86, reflex: 80, decision: 77, composure: 79, nationality: "US", price: 310 },
  { name: "Mako", role: "Support", aim: 73, reflex: 71, decision: 83, composure: 80, nationality: "DK", price: 258 },
  { name: "Rune", role: "Lurker", aim: 75, reflex: 78, decision: 74, composure: 77, nationality: "SE", price: 248 },
  { name: "Sage", role: "IGL", aim: 68, reflex: 69, decision: 89, composure: 85, nationality: "PL", price: 275 },
  { name: "Nox", role: "Entry", aim: 70, reflex: 73, decision: 66, composure: 65, nationality: "FR", price: 212 },
  { name: "Pixel", role: "Support", aim: 66, reflex: 68, decision: 74, composure: 72, nationality: "DE", price: 208 },
  { name: "Spark", role: "Sniper", aim: 82, reflex: 75, decision: 71, composure: 76, nationality: "RU", price: 268 },
  { name: "Slash", role: "Lurker", aim: 74, reflex: 77, decision: 75, composure: 70, nationality: "UA", price: 224 },
  { name: "Card", role: "IGL", aim: 65, reflex: 66, decision: 85, composure: 82, nationality: "CZ", price: 252 },
  { name: "Breeze", role: "Entry", aim: 81, reflex: 80, decision: 68, composure: 70, nationality: "IT", price: 246 },
  { name: "Coral", role: "Support", aim: 69, reflex: 72, decision: 81, composure: 79, nationality: "NL", price: 218 },
  { name: "Sentry", role: "Sniper", aim: 84, reflex: 78, decision: 73, composure: 80, nationality: "BE", price: 282 },
  { name: "Mist", role: "Lurker", aim: 76, reflex: 75, decision: 77, composure: 72, nationality: "CH", price: 238 },
  { name: "Pilot", role: "IGL", aim: 67, reflex: 65, decision: 87, composure: 84, nationality: "AT", price: 256 },
  { name: "Flame", role: "Entry", aim: 80, reflex: 82, decision: 67, composure: 66, nationality: "GR", price: 240 },
  { name: "Crest", role: "Support", aim: 71, reflex: 70, decision: 82, composure: 78, nationality: "IE", price: 226 },
  { name: "Scope", role: "Sniper", aim: 88, reflex: 81, decision: 74, composure: 82, nationality: "HU", price: 298 },
  { name: "Veil", role: "Lurker", aim: 77, reflex: 76, decision: 74, composure: 73, nationality: "RO", price: 242 },
  { name: "Warden", role: "IGL", aim: 64, reflex: 62, decision: 90, composure: 88, nationality: "BG", price: 264 },
  { name: "Blade", role: "Entry", aim: 83, reflex: 85, decision: 65, composure: 63, nationality: "SK", price: 262 },
  { name: "Cove", role: "Support", aim: 70, reflex: 71, decision: 83, composure: 80, nationality: "HR", price: 230 },
  { name: "Stride", role: "Sniper", aim: 85, reflex: 79, decision: 72, composure: 78, nationality: "RS", price: 275 },
  { name: "Shade", role: "Lurker", aim: 75, reflex: 77, decision: 76, composure: 71, nationality: "LT", price: 232 },
  { name: "Chief", role: "IGL", aim: 66, reflex: 64, decision: 88, composure: 85, nationality: "LV", price: 258 },
  { name: "Rush", role: "Entry", aim: 82, reflex: 84, decision: 66, composure: 65, nationality: "EE", price: 254 },
  { name: "Vault", role: "Support", aim: 68, reflex: 69, decision: 84, composure: 81, nationality: "SI", price: 222 },
  { name: "Snipe", role: "Sniper", aim: 87, reflex: 80, decision: 75, composure: 79, nationality: "BY", price: 288 },
  { name: "Lurk", role: "Lurker", aim: 74, reflex: 76, decision: 78, composure: 70, nationality: "MD", price: 236 },
  { name: "Tact", role: "IGL", aim: 65, reflex: 63, decision: 91, composure: 86, nationality: "AL", price: 266 },
  { name: "Dash", role: "Entry", aim: 79, reflex: 81, decision: 69, composure: 67, nationality: "MK", price: 244 },
  { name: "Bulk", role: "Support", aim: 67, reflex: 68, decision: 85, composure: 82, nationality: "BA", price: 216 },
  { name: "Cross", role: "Sniper", aim: 86, reflex: 77, decision: 73, composure: 81, nationality: "ME", price: 292 },
  { name: "Sneak", role: "Lurker", aim: 76, reflex: 74, decision: 75, composure: 72, nationality: "RS", price: 240 },
  { name: "Lead", role: "IGL", aim: 68, reflex: 66, decision: 89, composure: 87, nationality: "HR", price: 270 },
  { name: "Gale", role: "Entry", aim: 78, reflex: 80, decision: 70, composure: 68, nationality: "GE", price: 248 },
  { name: "Mend", role: "Support", aim: 72, reflex: 73, decision: 80, composure: 79, nationality: "LU", price: 228 },
  { name: "Lens", role: "Sniper", aim: 89, reflex: 82, decision: 76, composure: 83, nationality: "IS", price: 305 },
  { name: "Fade", role: "Lurker", aim: 73, reflex: 75, decision: 77, composure: 71, nationality: "CY", price: 234 },
  { name: "Call", role: "IGL", aim: 69, reflex: 67, decision: 86, composure: 84, nationality: "MT", price: 260 },
  { name: "Quake", role: "Entry", aim: 77, reflex: 79, decision: 68, composure: 69, nationality: "BR", price: 238 },
  { name: "Flux", role: "Support", aim: 70, reflex: 72, decision: 79, composure: 77, nationality: "NO", price: 224 },
  { name: "Peak", role: "Sniper", aim: 85, reflex: 80, decision: 74, composure: 78, nationality: "CA", price: 276 },
  { name: "Chill", role: "Lurker", aim: 72, reflex: 74, decision: 76, composure: 73, nationality: "FI", price: 230 },
  { name: "Base", role: "IGL", aim: 66, reflex: 65, decision: 85, composure: 83, nationality: "SE", price: 254 },
  { name: "Grit", role: "Entry", aim: 76, reflex: 78, decision: 69, composure: 70, nationality: "US", price: 232 },
  { name: "Latch", role: "Support", aim: 68, reflex: 70, decision: 82, composure: 78, nationality: "GB", price: 220 },
  { name: "Ridge", role: "Sniper", aim: 83, reflex: 77, decision: 71, composure: 76, nationality: "AU", price: 268 },
  { name: "Tide", role: "Lurker", aim: 74, reflex: 76, decision: 74, composure: 71, nationality: "NZ", price: 228 }
];

async function seedLeague() {
  let systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
  if (!systemUser) {
    const hash = await bcrypt.hash("league-system-no-login", 10);
    systemUser = await prisma.user.create({
      data: {
        email: SYSTEM_USER_EMAIL,
        name: "Liga",
        password: hash,
        walletBalance: 0
      }
    });
    console.log("Created system user for league.");
  }

  for (const teamDef of NPC_TEAMS) {
    const existing = await prisma.team.findFirst({
      where: { userId: systemUser.id, name: teamDef.name },
      include: { players: true }
    });
    if (existing && existing.players.length >= 5) {
      continue;
    }
    if (existing) {
      await prisma.team.delete({ where: { id: existing.id } });
    }

    const team = await prisma.team.create({
      data: {
        userId: systemUser.id,
        name: teamDef.name
      }
    });

    for (let i = 0; i < teamDef.players.length; i++) {
      const p = teamDef.players[i];
      await prisma.player.create({
        data: {
          teamId: team.id,
          name: p.name,
          role: p.role,
          aim: p.aim,
          reflex: p.reflex,
          decision: p.decision,
          composure: p.composure,
          isStarter: true,
          nationality: p.nationality,
          sortOrder: i
        }
      });
    }
    console.log(`Created NPC team: ${teamDef.name}`);
  }
}

/** Simula partidas entre times NPC para popular o ranking Elo */
async function seedBootstrapMatches() {
  const systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
  if (!systemUser) return;

  const npcTeams = await prisma.team.findMany({
    where: { userId: systemUser.id },
    select: { id: true, name: true }
  });
  if (npcTeams.length < 6) {
    console.log("Skipping bootstrap matches: need at least 6 NPC teams.");
    return;
  }

  const existing = await prisma.season.findFirst({
    where: { userId: systemUser.id, name: "Bootstrap Ranking" },
    include: { matches: true }
  });
  if (existing && existing.matches.some((m) => m.status === "finished")) {
    console.log("Bootstrap matches already played. Skip.");
    return;
  }
  if (existing) {
    await prisma.match.deleteMany({ where: { seasonId: existing.id } });
    await prisma.season.delete({ where: { id: existing.id } });
  }

  const season = await prisma.season.create({
    data: {
      userId: systemUser.id,
      name: "Bootstrap Ranking",
      status: "active"
    }
  });

  // Pares para partidas: cada time joga 3–4 vezes
  const teamIds = npcTeams.map((t) => t.id);
  const pairs: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  // Embaralha e pega ~20 partidas para popular ranking
  const shuffled = [...pairs].sort(() => Math.random() - 0.5);
  const toPlay = shuffled.slice(0, Math.min(20, pairs.length));

  let round = 1;
  for (const [a, b] of toPlay) {
    await prisma.match.create({
      data: {
        seasonId: season.id,
        round: round++,
        teamAId: a,
        teamBId: b
      }
    });
  }

  const matches = await prisma.match.findMany({
    where: { seasonId: season.id },
    orderBy: { round: "asc" }
  });

  const scoreOptions = [
    [13, 10],
    [13, 11],
    [16, 14],
    [13, 9],
    [13, 8]
  ];

  for (const m of matches) {
    const [scoreA, scoreB] = scoreOptions[Math.floor(Math.random() * scoreOptions.length)];
    const winnerId = Math.random() > 0.5 ? m.teamAId : m.teamBId;
    await persistMatchResult(m.id, {
      winnerId,
      scoreA: winnerId === m.teamAId ? scoreA : scoreB,
      scoreB: winnerId === m.teamAId ? scoreB : scoreA
    });
  }

  console.log(`Simulated ${matches.length} bootstrap matches between NPC teams.`);
}

async function main() {
  const count = await prisma.playerTemplate.count();
  if (count > 0) {
    console.log(`Catalog already has ${count} templates. Skip seed.`);
  } else {
    for (const t of TEMPLATES) {
      const rarity = t.price >= 380 ? "legendary" : t.price >= 300 ? "epic" : t.price >= 260 ? "rare" : "common";
      await prisma.playerTemplate.create({
        data: {
          name: t.name,
          role: t.role,
          aim: t.aim,
          reflex: t.reflex,
          decision: t.decision,
          composure: t.composure,
          nationality: t.nationality,
          rarity,
          price: t.price
        }
      });
    }
    console.log(`Seeded ${await prisma.playerTemplate.count()} player templates.`);
  }

  await seedLeague();
  await seedBootstrapMatches();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
