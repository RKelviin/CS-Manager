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
import {
  createPlayerBodySchema,
  createTeamBodySchema,
  teamIdParamsSchema,
  teamPlayerParamsSchema,
  updatePlayerBodySchema,
  updateTeamBodySchema
} from "../../shared/schemas.js";
import { businessErrorPayload, isBusinessError } from "../../shared/errors.js";
import { parseBody, parseParams } from "../../shared/validation.js";

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
  const p = parseParams(teamIdParamsSchema, req.params, res);
  if (!p) return;
  try {
    const userId = req.userId!;
    const team = await findTeamById(p.teamId, userId);
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
  const body = parseBody(createTeamBodySchema, req.body, res);
  if (!body) return;
  try {
    const userId = req.userId!;
    const team = await createTeam(userId, body);
    res.status(201).json(team);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create team";
    res.status(400).json({ error: msg });
  }
});

teamRoutes.patch("/:teamId", async (req: AuthRequest, res: Response) => {
  const p = parseParams(teamIdParamsSchema, req.params, res);
  if (!p) return;
  const body = parseBody(updateTeamBodySchema, req.body, res);
  if (!body) return;
  try {
    const userId = req.userId!;
    const team = await updateTeam(p.teamId, userId, body);
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
  const p = parseParams(teamIdParamsSchema, req.params, res);
  if (!p) return;
  try {
    const userId = req.userId!;
    await deleteTeam(p.teamId, userId);
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
  const p = parseParams(teamIdParamsSchema, req.params, res);
  if (!p) return;
  const body = parseBody(createPlayerBodySchema, req.body, res);
  if (!body) return;
  try {
    const userId = req.userId!;
    const player = await addPlayer(p.teamId, userId, body);
    res.status(201).json(player);
  } catch (err) {
    if (isBusinessError(err)) {
      res.status(400).json(businessErrorPayload(err));
      return;
    }
    const msg = err instanceof Error ? err.message : "Failed to add player";
    if (msg === "Team not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
});

teamRoutes.patch("/:teamId/players/:playerId", async (req: AuthRequest, res: Response) => {
  const p = parseParams(teamPlayerParamsSchema, req.params, res);
  if (!p) return;
  const body = parseBody(updatePlayerBodySchema, req.body, res);
  if (!body) return;
  try {
    const userId = req.userId!;
    const player = await updatePlayer(p.teamId, p.playerId, userId, body);
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
  const p = parseParams(teamPlayerParamsSchema, req.params, res);
  if (!p) return;
  try {
    const userId = req.userId!;
    await removePlayer(p.teamId, p.playerId, userId);
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
  const p = parseParams(teamPlayerParamsSchema, req.params, res);
  if (!p) return;
  try {
    const userId = req.userId!;
    const { sellPrice } = await sellPlayer(p.teamId, p.playerId, userId);
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
