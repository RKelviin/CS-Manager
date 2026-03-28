import { Router, Response } from "express";
import { authMiddleware, type AuthRequest } from "../../shared/middleware/authMiddleware.js";
import { purchaseTemplate, purchaseBoosterPack, listTemplates } from "./market.service.js";
import { marketBoosterBodySchema, marketPurchaseBodySchema } from "../../shared/schemas.js";
import { businessErrorPayload, isBusinessError } from "../../shared/errors.js";
import { parseBody } from "../../shared/validation.js";

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
  const body = parseBody(marketPurchaseBodySchema, req.body, res);
  if (!body) return;
  try {
    const userId = req.userId!;
    const player = await purchaseTemplate(userId, body.templateId, body.teamId);
    res.status(201).json(player);
  } catch (err) {
    if (isBusinessError(err)) {
      res.status(400).json(businessErrorPayload(err));
      return;
    }
    const msg = err instanceof Error ? err.message : "Purchase failed";
    if (msg === "Template not found" || msg === "Team not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
});

marketRoutes.post("/booster-pack", authMiddleware, async (req: AuthRequest, res: Response) => {
  const body = parseBody(marketBoosterBodySchema, req.body, res);
  if (!body) return;
  try {
    const userId = req.userId!;
    const players = await purchaseBoosterPack(userId, body.teamId);
    res.status(201).json(players);
  } catch (err) {
    if (isBusinessError(err)) {
      res.status(400).json(businessErrorPayload(err));
      return;
    }
    const msg = err instanceof Error ? err.message : "Booster pack purchase failed";
    if (msg === "Team not found" || msg === "User not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
});
