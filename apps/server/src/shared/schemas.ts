import { z } from "zod";

const roleEnum = z.enum(["Sniper", "Entry", "Support", "Lurker", "IGL"]);

const cuidParam = z.cuid("Identificador inválido.");

export const signupBodySchema = z.object({
  email: z.string().trim().email("Email inválido."),
  name: z.string().trim().min(1, "Nome é obrigatório.").max(120),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128)
});

export const loginBodySchema = z.object({
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(1, "Senha é obrigatória.")
});

export const createTeamBodySchema = z.object({
  name: z.string().trim().min(1, "Nome do time é obrigatório.").max(120)
});

export const updateTeamBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    wins: z.number().int().min(0).optional(),
    losses: z.number().int().min(0).optional()
  })
  .refine((o) => o.name !== undefined || o.wins !== undefined || o.losses !== undefined, {
    message: "Envie pelo menos um campo para atualizar."
  });

export const teamIdParamsSchema = z.object({
  teamId: cuidParam
});

export const teamPlayerParamsSchema = z.object({
  teamId: cuidParam,
  playerId: cuidParam
});

export const createPlayerBodySchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório.").max(80),
  role: roleEnum,
  aim: z.number().int().min(0).max(100),
  reflex: z.number().int().min(0).max(100),
  decision: z.number().int().min(0).max(100),
  composure: z.number().int().min(0).max(100),
  isStarter: z.boolean().optional(),
  nationality: z.string().trim().max(2).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable()
});

export const updatePlayerBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    role: roleEnum.optional(),
    aim: z.number().int().min(0).max(100).optional(),
    reflex: z.number().int().min(0).max(100).optional(),
    decision: z.number().int().min(0).max(100).optional(),
    composure: z.number().int().min(0).max(100).optional(),
    isStarter: z.boolean().optional(),
    nationality: z.string().trim().max(2).optional().nullable(),
    avatarUrl: z.string().url().optional().nullable(),
    sortOrder: z.number().int().min(0).optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Envie pelo menos um campo para atualizar." });

export const marketPurchaseBodySchema = z.object({
  templateId: cuidParam,
  teamId: cuidParam
});

export const marketBoosterBodySchema = z.object({
  teamId: cuidParam
});

export const placeBetBodySchema = z.object({
  matchId: cuidParam,
  teamId: cuidParam,
  amount: z.number().int().min(100).max(10000)
});

export const matchIdParamsSchema = z.object({
  matchId: cuidParam
});
