import { Router, Response } from "express";
import { authMiddleware, type AuthRequest } from "../../shared/middleware/authMiddleware.js";
import {
  getOrCreateActiveSeason,
  getMatches,
  getMatchById,
  persistMatchResult,
  getRanking,
  getPlayerRanking,
  type PersistMatchBody
} from "./simulation.service.js";

export const simulationRoutes = Router();

simulationRoutes.get("/", (_req, res) => {
  res.json({ module: "simulation", status: "ready" });
});

simulationRoutes.get("/season", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const season = await getOrCreateActiveSeason(userId);
    res.json(season);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get season";
    res.status(500).json({ error: msg });
  }
});

simulationRoutes.get("/matches", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const status = req.query.status as "scheduled" | "finished" | undefined;
    const season = await getOrCreateActiveSeason(userId);
    if (!season) throw new Error("Season not found");
    const matches = await getMatches(season.id, status);
    res.json(matches);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list matches";
    res.status(500).json({ error: msg });
  }
});

simulationRoutes.get("/matches/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const matchId = req.params.id as string;
    const match = await getMatchById(matchId);
    res.json(match);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get match";
    if (msg === "Match not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

simulationRoutes.post("/matches/:id/run", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const matchId = req.params.id as string;
    const userId = req.userId!;
    const body = req.body as PersistMatchBody;

    if (!body.winnerId || body.scoreA == null || body.scoreB == null) {
      res.status(400).json({ error: "winnerId, scoreA, scoreB are required" });
      return;
    }

    const match = await getMatchById(matchId);
    const seasonOwner = match.season.userId;
    if (!seasonOwner || seasonOwner !== userId) {
      res.status(403).json({ error: "Match does not belong to your season" });
      return;
    }

    const updated = await persistMatchResult(matchId, body);
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to persist match result";
    if (msg === "Match not found") {
      res.status(404).json({ error: msg });
      return;
    }
    if (msg === "Match already finished") {
      res.status(400).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

simulationRoutes.get("/ranking", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const season = await getOrCreateActiveSeason(userId);
    if (!season) throw new Error("Season not found");
    const ranking = await getRanking(season.id);
    res.json(ranking);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get ranking";
    res.status(500).json({ error: msg });
  }
});

simulationRoutes.get("/ranking/players", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const season = await getOrCreateActiveSeason(userId);
    if (!season) throw new Error("Season not found");
    const ranking = await getPlayerRanking(season.id);
    res.json(ranking);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get player ranking";
    res.status(500).json({ error: msg });
  }
});
