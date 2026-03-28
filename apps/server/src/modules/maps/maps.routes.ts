import { Router } from "express";
import { listMaps, getMap, saveMap } from "./maps.service.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const maps = await listMaps();
    res.json(maps);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const map = await getMap(req.params.id);
    if (!map) return res.status(404).json({ error: "Mapa não encontrado" });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { id, name } = await saveMap(req.body);
    res.status(201).json({ id, name });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

export const mapsRoutes = router;
