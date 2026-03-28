import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getAuthRateLimitMax } from "../../app.js";
import { signup, login } from "./auth.service.js";
import { authMiddleware, type AuthRequest } from "../../shared/middleware/authMiddleware.js";
import { toUserFriendlyError } from "../../shared/errors.js";
import { prisma } from "../../db/index.js";
import { loginBodySchema, signupBodySchema } from "../../shared/schemas.js";
import { parseBody } from "../../shared/validation.js";

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: getAuthRateLimitMax(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      code: "RATE_LIMITED"
    });
  }
});

export const authRoutes = Router();

authRoutes.post("/signup", authRateLimiter, async (req: Request, res: Response) => {
  const body = parseBody(signupBodySchema, req.body, res);
  if (!body) return;
  try {
    const result = await signup(body);
    res.status(201).json(result);
  } catch (err) {
    const msg = toUserFriendlyError(err);
    const isEmailExists = err instanceof Error && err.message === "Email already registered";
    res.status(isEmailExists ? 409 : 400).json({ error: msg });
  }
});

authRoutes.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  const body = parseBody(loginBodySchema, req.body, res);
  if (!body) return;
  try {
    const result = await login(body);
    res.json(result);
  } catch (err) {
    const msg = toUserFriendlyError(err);
    const isInvalidCreds = err instanceof Error && err.message === "Invalid email or password";
    res.status(isInvalidCreds ? 401 : 400).json({ error: msg });
  }
});

authRoutes.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, walletBalance: true }
    });
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: toUserFriendlyError(err) });
  }
});
