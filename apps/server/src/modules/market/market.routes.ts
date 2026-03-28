import { Router, Response } from "express";
import { authMiddleware, type AuthRequest } from "../../shared/middleware/authMiddleware.js";
import { purchaseTemplate, purchaseBoosterPack, listTemplates } from "./market.service.js";

export const marketRoutes = Router();

marketRoutes.get("/listings", async (_req, res: Response) => {
  try {
    const templates = await listTemplates();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list market" });
  }
});

marketRoutes.post("/purchase", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { templateId, teamId } = req.body as { templateId?: string; teamId?: string };
    if (!templateId?.trim() || !teamId?.trim()) {
      res.status(400).json({ error: "templateId and teamId are required" });
      return;
    }
    const player = await purchaseTemplate(userId, templateId, teamId);
    res.status(201).json(player);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Purchase failed";
    if (msg === "Insufficient balance") {
      res.status(400).json({ error: msg });
      return;
    }
    if (msg === "Template not found" || msg === "Team not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
});

marketRoutes.post("/booster-pack", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { teamId } = req.body as { teamId?: string };
    if (!teamId?.trim()) {
      res.status(400).json({ error: "teamId is required" });
      return;
    }
    const players = await purchaseBoosterPack(userId, teamId);
    res.status(201).json(players);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Booster pack purchase failed";
    if (msg === "Insufficient balance") {
      res.status(400).json({ error: msg });
      return;
    }
    if (msg === "Team not found" || msg === "User not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
});
