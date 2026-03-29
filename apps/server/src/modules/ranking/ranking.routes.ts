import { Router, Response } from "express";
import { getGlobalRanking, getTeamRatingHistory } from "./rating.service.js";

export const rankingRoutes = Router();

rankingRoutes.get("/global", async (req, res: Response) => {
  try {
    const limit = Math.min(100, parseInt(String(req.query.limit), 10) || 100);
    const offsetRaw = req.query.offset;
    const offset =
      offsetRaw !== undefined ? Math.max(0, parseInt(String(offsetRaw), 10) || 0) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await getGlobalRanking({
      limit,
      ...(offset !== undefined ? { offset } : {}),
      ...(cursor ? { cursor } : {})
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get ranking";
    if (msg === "Invalid ranking cursor") {
      res.status(400).json({ error: msg });
      return;
    }
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
