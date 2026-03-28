import { prisma } from "../../db/index.js";
import type { CreateTeamBody, UpdateTeamBody, CreatePlayerBody, UpdatePlayerBody } from "./team.types.js";

/** 5 jogadores de raridade baixa para time inicial no signup */
const STARTER_PLAYERS: Omit<CreatePlayerBody, "isStarter">[] = [
  { name: "Rust", role: "Entry", aim: 58, reflex: 62, decision: 55, composure: 58, nationality: "PL" },
  { name: "Dust", role: "Support", aim: 48, reflex: 52, decision: 55, composure: 50, nationality: "PT" },
  { name: "Zero", role: "Lurker", aim: 42, reflex: 45, decision: 48, composure: 44, nationality: "TR" },
  { name: "Nex", role: "Sniper", aim: 52, reflex: 50, decision: 54, composure: 51, nationality: "CZ" },
  { name: "Chip", role: "IGL", aim: 55, reflex: 52, decision: 62, composure: 58, nationality: "DK" }
];

export async function createDefaultTeamForUser(userId: string) {
  const team = await prisma.team.create({
    data: { userId, name: "Meu Time" },
    include: { players: true }
  });
  for (let i = 0; i < STARTER_PLAYERS.length; i++) {
    const p = STARTER_PLAYERS[i];
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
        nationality: p.nationality ?? null,
        sortOrder: i
      }
    });
  }
  return prisma.team.findFirst({
    where: { id: team.id },
    include: { players: { orderBy: [{ isStarter: "desc" }, { sortOrder: "asc" }] } }
  })!;
}

export async function findTeamsByUserId(userId: string) {
  return prisma.team.findMany({
    where: { userId },
    include: { players: { orderBy: [{ isStarter: "desc" }, { sortOrder: "asc" }] } }
  });
}

export async function findTeamById(teamId: string, userId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, userId },
    include: { players: { orderBy: [{ isStarter: "desc" }, { sortOrder: "asc" }] } }
  });
  if (!team) throw new Error("Team not found");
  return team;
}

export async function createTeam(userId: string, body: CreateTeamBody) {
  return prisma.team.create({
    data: { userId, name: body.name.trim() },
    include: { players: true }
  });
}

export async function updateTeam(teamId: string, userId: string, body: UpdateTeamBody) {
  await findTeamById(teamId, userId);
  return prisma.team.update({
    where: { id: teamId },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.wins !== undefined && { wins: body.wins }),
      ...(body.losses !== undefined && { losses: body.losses })
    },
    include: { players: { orderBy: [{ isStarter: "desc" }, { sortOrder: "asc" }] } }
  });
}

export async function deleteTeam(teamId: string, userId: string) {
  await findTeamById(teamId, userId);
  await prisma.team.delete({ where: { id: teamId } });
}

export async function addPlayer(teamId: string, userId: string, body: CreatePlayerBody) {
  const team = await findTeamById(teamId, userId);
  const maxOrder = team.players.reduce((max, p) => Math.max(max, p.sortOrder), 0);
  return prisma.player.create({
    data: {
      teamId,
      name: body.name.trim(),
      role: body.role,
      aim: body.aim,
      reflex: body.reflex,
      decision: body.decision,
      composure: body.composure,
      isStarter: body.isStarter ?? false,
      nationality: body.nationality ?? null,
      avatarUrl: body.avatarUrl ?? null,
      sortOrder: maxOrder + 1
    }
  });
}

export async function updatePlayer(
  teamId: string,
  playerId: string,
  userId: string,
  body: UpdatePlayerBody
) {
  await findTeamById(teamId, userId);
  const existing = await prisma.player.findFirst({
    where: { id: playerId, teamId }
  });
  if (!existing) throw new Error("Player not found");

  return prisma.player.update({
    where: { id: playerId },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.role !== undefined && { role: body.role }),
      ...(body.aim !== undefined && { aim: body.aim }),
      ...(body.reflex !== undefined && { reflex: body.reflex }),
      ...(body.decision !== undefined && { decision: body.decision }),
      ...(body.composure !== undefined && { composure: body.composure }),
      ...(body.isStarter !== undefined && { isStarter: body.isStarter }),
      ...(body.nationality !== undefined && { nationality: body.nationality }),
      ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder })
    }
  });
}

export async function removePlayer(teamId: string, playerId: string, userId: string) {
  await findTeamById(teamId, userId);
  const existing = await prisma.player.findFirst({
    where: { id: playerId, teamId }
  });
  if (!existing) throw new Error("Player not found");
  await prisma.player.delete({ where: { id: playerId } });
}

function getSellPrice(aim: number, reflex: number, decision: number, composure: number): number {
  const avg = (aim + reflex + decision + composure) / 4;
  return Math.max(50, Math.round(avg * 2.5));
}

export async function sellPlayer(teamId: string, playerId: string, userId: string) {
  const team = await findTeamById(teamId, userId);
  const player = team.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Player not found");

  const sellPrice = getSellPrice(player.aim, player.reflex, player.decision, player.composure);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: sellPrice } }
    }),
    prisma.player.delete({ where: { id: playerId } })
  ]);

  return { sellPrice };
}
