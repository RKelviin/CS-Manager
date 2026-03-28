import { Router, Response } from "express";
import { authMiddleware, type AuthRequest } from "../../shared/middleware/authMiddleware.js";
import {
  findTeamsByUserId,
  findTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  addPlayer,
  updatePlayer,
  removePlayer,
  sellPlayer
} from "./team.service.js";
import type { CreateTeamBody, UpdateTeamBody, CreatePlayerBody, UpdatePlayerBody } from "./team.types.js";

export const teamRoutes = Router();

teamRoutes.use(authMiddleware);

teamRoutes.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const teams = await findTeamsByUserId(userId);
    res.json(teams);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list teams";
    res.status(500).json({ error: msg });
  }
});

teamRoutes.get("/:teamId", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const userId = req.userId!;
    const team = await findTeamById(teamId, userId);
    res.json(team);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get team";
    if (msg === "Team not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

teamRoutes.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const body = req.body as CreateTeamBody;
    if (!body.name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const team = await createTeam(userId, body);
    res.status(201).json(team);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create team";
    res.status(400).json({ error: msg });
  }
});

teamRoutes.patch("/:teamId", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const userId = req.userId!;
    const body = req.body as UpdateTeamBody;
    const team = await updateTeam(teamId, userId, body);
    res.json(team);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update team";
    if (msg === "Team not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
});

teamRoutes.delete("/:teamId", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const userId = req.userId!;
    await deleteTeam(teamId, userId);
    res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete team";
    if (msg === "Team not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

teamRoutes.post("/:teamId/players", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const userId = req.userId!;
    const body = req.body as CreatePlayerBody;
    if (!body.name?.trim() || !body.role || body.aim == null || body.reflex == null || body.decision == null || body.composure == null) {
      res.status(400).json({ error: "name, role, aim, reflex, decision, composure are required" });
      return;
    }
    const player = await addPlayer(teamId, userId, body);
    res.status(201).json(player);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to add player";
    if (msg === "Team not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
});

teamRoutes.patch("/:teamId/players/:playerId", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const playerId = req.params.playerId as string;
    const userId = req.userId!;
    const body = req.body as UpdatePlayerBody;
    const player = await updatePlayer(teamId, playerId, userId, body);
    res.json(player);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update player";
    if (msg === "Team not found" || msg === "Player not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
});

teamRoutes.delete("/:teamId/players/:playerId", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const playerId = req.params.playerId as string;
    const userId = req.userId!;
    await removePlayer(teamId, playerId, userId);
    res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to remove player";
    if (msg === "Team not found" || msg === "Player not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

teamRoutes.post("/:teamId/players/:playerId/sell", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const playerId = req.params.playerId as string;
    const userId = req.userId!;
    const { sellPrice } = await sellPlayer(teamId, playerId, userId);
    res.json({ sellPrice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to sell player";
    if (msg === "Team not found" || msg === "Player not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});
