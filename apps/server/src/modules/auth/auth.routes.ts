import { Router, Request, Response } from "express";
import { signup, login } from "./auth.service.js";
import type { SignupBody, LoginBody } from "./auth.types.js";
import { authMiddleware, type AuthRequest } from "../../shared/middleware/authMiddleware.js";
import { toUserFriendlyError } from "../../shared/errors.js";
import { prisma } from "../../db/index.js";

export const authRoutes = Router();

authRoutes.post("/signup", async (req: Request, res: Response) => {
  try {
    const body = req.body as SignupBody;
    if (!body.email || !body.name || !body.password) {
      res.status(400).json({ error: "Preencha email, nome e senha." });
      return;
    }
    const result = await signup(body);
    res.status(201).json(result);
  } catch (err) {
    const msg = toUserFriendlyError(err);
    const isEmailExists = err instanceof Error && err.message === "Email already registered";
    res.status(isEmailExists ? 409 : 400).json({ error: msg });
  }
});

authRoutes.post("/login", async (req: Request, res: Response) => {
  try {
    const body = req.body as LoginBody;
    if (!body.email || !body.password) {
      res.status(400).json({ error: "Preencha email e senha." });
      return;
    }
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
