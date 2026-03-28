import { prisma } from "../../db/index.js";
import { BusinessError, BusinessErrorCode } from "../../shared/errors.js";
import { MAX_PLAYERS_PER_TEAM } from "../../shared/teamLimits.js";

/** Preço fixo do booster pack: 5 jogadores aleatórios */
export const BOOSTER_PACK_PRICE = 1000;

export async function listTemplates() {
  return prisma.playerTemplate.findMany({
    orderBy: { price: "asc" }
  });
}

/** Retorna 5 templates aleatórios distintos */
function pickRandomTemplates<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function purchaseBoosterPack(userId: string, teamId: string) {
  const [user, team, templates] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.team.findFirst({ where: { id: teamId, userId }, include: { players: true } }),
    prisma.playerTemplate.findMany()
  ]);
  if (!user) throw new Error("User not found");
  if (!team) throw new Error("Team not found");
  if (user.walletBalance < BOOSTER_PACK_PRICE) {
    throw new BusinessError(BusinessErrorCode.INSUFFICIENT_BALANCE);
  }
  if (templates.length < 5) throw new Error("Not enough templates available");
  if (team.players.length + 5 > MAX_PLAYERS_PER_TEAM) {
    throw new BusinessError(BusinessErrorCode.TEAM_FULL);
  }

  const selected = pickRandomTemplates(templates, 5);
  const maxOrder = team.players.reduce((max, p) => Math.max(max, p.sortOrder), 0);

  const created = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: user.walletBalance - BOOSTER_PACK_PRICE }
    });
    const players = [];
    for (let i = 0; i < selected.length; i++) {
      const t = selected[i];
      const p = await tx.player.create({
        data: {
          teamId,
          name: t.name,
          role: t.role,
          aim: t.aim,
          reflex: t.reflex,
          decision: t.decision,
          composure: t.composure,
          nationality: t.nationality,
          isStarter: false,
          templateId: t.id,
          sortOrder: maxOrder + 1 + i
        }
      });
      players.push(p);
    }
    return players;
  });

  return created;
}

export async function purchaseTemplate(userId: string, templateId: string, teamId: string) {
  const [user, template, team] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.playerTemplate.findUnique({ where: { id: templateId } }),
    prisma.team.findFirst({ where: { id: teamId, userId }, include: { players: true } })
  ]);
  if (!user) throw new Error("User not found");
  if (!template) throw new Error("Template not found");
  if (!team) throw new Error("Team not found");
  if (team.players.length >= MAX_PLAYERS_PER_TEAM) {
    throw new BusinessError(BusinessErrorCode.TEAM_FULL);
  }
  if (user.walletBalance < template.price) {
    throw new BusinessError(BusinessErrorCode.INSUFFICIENT_BALANCE);
  }

  const maxOrder = team.players.reduce((max, p) => Math.max(max, p.sortOrder), 0);

  const player = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: user.walletBalance - template.price }
    });
    return tx.player.create({
      data: {
        teamId,
        name: template.name,
        role: template.role,
        aim: template.aim,
        reflex: template.reflex,
        decision: template.decision,
        composure: template.composure,
        nationality: template.nationality,
        isStarter: false,
        templateId: template.id,
        sortOrder: maxOrder + 1
      }
    });
  });

  return player;
}
