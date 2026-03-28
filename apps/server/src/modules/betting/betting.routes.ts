import { Router } from "express";

export const bettingRoutes = Router();

bettingRoutes.get("/", (_req, res) => {
  res.json({ module: "betting", status: "ready" });
});
