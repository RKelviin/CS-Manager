import { Router, Response } from "express";
import { authMiddleware, type AuthRequest } from "../../shared/middleware/authMiddleware.js";
import { placeBet, getUserBets, getMatchOdds } from "./betting.service.js";
import { placeBetBodySchema, matchIdParamsSchema } from "../../shared/schemas.js";
import { businessErrorPayload, isBusinessError } from "../../shared/errors.js";
import { parseBody, parseParams } from "../../shared/validation.js";

export const bettingRoutes = Router();

bettingRoutes.post("/bets", authMiddleware, async (req: AuthRequest, res: Response) => {
  const body = parseBody(placeBetBodySchema, req.body, res);
  if (!body) return;
  try {
    const userId = req.userId!;
    const bet = await placeBet(userId, body.matchId, body.teamId, body.amount);
    res.status(201).json(bet);
  } catch (err) {
    if (isBusinessError(err)) {
      res.status(400).json(businessErrorPayload(err));
      return;
    }
    const msg = err instanceof Error ? err.message : "Bet failed";
    if (msg === "Match not found" || msg === "User not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

bettingRoutes.get("/bets", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const bets = await getUserBets(userId);
    res.json(bets);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list bets";
    res.status(500).json({ error: msg });
  }
});

bettingRoutes.get("/matches/:matchId/odds", authMiddleware, async (req: AuthRequest, res: Response) => {
  const params = parseParams(matchIdParamsSchema, req.params, res);
  if (!params) return;
  try {
    const odds = await getMatchOdds(params.matchId);
    res.json(odds);
  } catch (err) {
    if (isBusinessError(err)) {
      res.status(400).json(businessErrorPayload(err));
      return;
    }
    const msg = err instanceof Error ? err.message : "Failed to get odds";
    if (msg === "Match not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});
