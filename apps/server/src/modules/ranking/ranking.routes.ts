import { Router, Response } from "express";
import { getGlobalRanking, getTeamRatingHistory } from "./rating.service.js";

export const rankingRoutes = Router();

rankingRoutes.get("/global", async (req, res: Response) => {
  try {
    const limit = Math.min(100, parseInt(String(req.query.limit), 10) || 100);
    const offset = Math.max(0, parseInt(String(req.query.offset), 10) || 0);
    const result = await getGlobalRanking(limit, offset);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get ranking";
    res.status(500).json({ error: msg });
  }
});

rankingRoutes.get("/teams/:teamId/history", async (req, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const result = await getTeamRatingHistory(teamId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get team history";
    if (msg === "Team not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});
