import { Router, Response } from "express";
import { authMiddleware, type AuthRequest } from "../../shared/middleware/authMiddleware.js";
import {
  getChampionshipTemplates,
  startChampionship,
  listChampionshipRuns,
  getChampionshipRun
} from "./championship.service.js";

export const championshipRoutes = Router();

championshipRoutes.get("/templates", (_req, res: Response) => {
  res.json(getChampionshipTemplates());
});

championshipRoutes.get("/runs", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const runs = await listChampionshipRuns(userId);
    res.json(runs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list championships";
    res.status(500).json({ error: msg });
  }
});

championshipRoutes.get("/runs/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const seasonId = req.params.id as string;
    const userId = req.userId!;
    const run = await getChampionshipRun(seasonId, userId);
    res.json(run);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get championship";
    if (msg === "Campeonato não encontrado") res.status(404).json({ error: msg });
    else res.status(500).json({ error: msg });
  }
});

championshipRoutes.post("/start", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const format = req.body?.format as 2 | 4 | 8;
    if (![2, 4, 8].includes(format)) {
      res.status(400).json({ error: "format must be 2, 4 or 8" });
      return;
    }
    const season = await startChampionship(userId, format);
    res.json(season);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start championship";
    res.status(500).json({ error: msg });
  }
});
