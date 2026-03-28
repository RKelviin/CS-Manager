import cors from "cors";
import express from "express";
import { registerModuleRoutes } from "./modules/index.js";

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "cs-manager-server" });
  });

  app.use("/api", registerModuleRoutes());

  return app;
};
