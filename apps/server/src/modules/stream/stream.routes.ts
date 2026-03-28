import { Router } from "express";

export const streamRoutes = Router();

streamRoutes.get("/", (_req, res) => {
  res.json({ module: "stream", status: "ready" });
});
