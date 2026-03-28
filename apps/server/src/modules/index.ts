import { Router } from "express";
import { authRoutes } from "./auth/auth.routes.js";
import { bettingRoutes } from "./betting/betting.routes.js";
import { championshipRoutes } from "./championship/championship.routes.js";
import { mapsRoutes } from "./maps/maps.routes.js";
import { marketRoutes } from "./market/market.routes.js";
import { rankingRoutes } from "./ranking/ranking.routes.js";
import { simulationRoutes } from "./simulation/simulation.routes.js";
import { streamRoutes } from "./stream/stream.routes.js";
import { teamRoutes } from "./team/team.routes.js";

export const registerModuleRoutes = () => {
  const router = Router();

  router.use("/auth", authRoutes);
  router.use("/team", teamRoutes);
  router.use("/market", marketRoutes);
  router.use("/simulation", simulationRoutes);
  router.use("/championships", championshipRoutes);
  router.use("/ranking", rankingRoutes);
  router.use("/betting", bettingRoutes);
  router.use("/stream", streamRoutes);
  router.use("/maps", mapsRoutes);

  return router;
};
