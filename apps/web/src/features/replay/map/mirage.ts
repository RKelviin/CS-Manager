/**
 * Mapa customizado: Mirage
 * Gerado pelo Editor de mapas.
 */
import type { MapData } from "./mapTypes";

export const MIRAGE_MAP: MapData = {
  "name": "Mirage",
  "width": 800,
  "height": 600,
  "walls": [
    {
      "x": 0,
      "y": 0,
      "width": 800,
      "height": 10
    },
    {
      "x": 0,
      "y": 590,
      "width": 800,
      "height": 10
    },
    {
      "x": 0,
      "y": 0,
      "width": 10,
      "height": 600
    },
    {
      "x": 790,
      "y": 0,
      "width": 10,
      "height": 600
    },
    {
      "x": 590,
      "y": 160,
      "width": 50,
      "height": 90
    },
    {
      "x": 160,
      "y": 310,
      "width": 50,
      "height": 80
    },
    {
      "x": 640,
      "y": 430,
      "width": 150,
      "height": 160
    },
    {
      "x": 10,
      "y": 490,
      "width": 180,
      "height": 100
    },
    {
      "x": 280,
      "y": 130,
      "width": 110,
      "height": 40
    },
    {
      "x": 430,
      "y": 310,
      "width": 70,
      "height": 100
    },
    {
      "x": 430,
      "y": 250,
      "width": 210,
      "height": 60
    },
    {
      "x": 160,
      "y": 250,
      "width": 180,
      "height": 60
    }
  ],
  "zones": [
    {
      "id": "site-a",
      "name": "Site A",
      "x": 650,
      "y": 50,
      "width": 100,
      "height": 100,
      "type": "site"
    },
    {
      "id": "site-b",
      "name": "Site B",
      "x": 50,
      "y": 50,
      "width": 100,
      "height": 100,
      "type": "site"
    },
    {
      "id": "spawn-t",
      "name": "T Spawn",
      "x": 300,
      "y": 500,
      "width": 200,
      "height": 80,
      "type": "spawn"
    },
    {
      "id": "spawn-ct",
      "name": "CT Spawn",
      "x": 300,
      "y": 20,
      "width": 200,
      "height": 80,
      "type": "spawn"
    }
  ],
  "spawnPoints": {
    "RED": [
      {
        "x": 320,
        "y": 540
      },
      {
        "x": 360,
        "y": 540
      },
      {
        "x": 400,
        "y": 540
      },
      {
        "x": 440,
        "y": 540
      },
      {
        "x": 480,
        "y": 540
      }
    ],
    "BLU": [
      {
        "x": 320,
        "y": 60
      },
      {
        "x": 360,
        "y": 60
      },
      {
        "x": 400,
        "y": 60
      },
      {
        "x": 440,
        "y": 60
      },
      {
        "x": 480,
        "y": 60
      }
    ]
  },
  "interestPoints": [
    { "id": "mir-a-ramp", "x": 560, "y": 200, "type": "angle", "side": "both", "aimAngle": -1.0 },
    { "id": "mir-jungle", "x": 480, "y": 140, "type": "choke", "side": "CT", "aimAngle": 1.2 },
    { "id": "mir-mid", "x": 400, "y": 300, "type": "choke", "side": "both", "aimAngle": -1.5 },
    { "id": "mir-b-short", "x": 220, "y": 200, "type": "flank", "side": "TR", "aimAngle": 0.8 },
    { "id": "mir-site-a", "x": 700, "y": 100, "type": "cover", "side": "CT", "aimAngle": 1.4 },
    { "id": "mir-site-b", "x": 100, "y": 100, "type": "cover", "side": "CT", "aimAngle": 0.2 }
  ],
  "tacticalSpots": [
    { "x": 520, "y": 180, "watchAngle": -0.9, "label": "A-ramp", "side": "both" },
    { "x": 450, "y": 120, "watchAngle": 1.3, "label": "jungle", "side": "CT" },
    { "x": 400, "y": 260, "watchAngle": 1.5, "label": "mid-window", "side": "both" },
    { "x": 200, "y": 160, "watchAngle": 0.6, "label": "B-apps", "side": "both" },
    { "x": 680, "y": 105, "watchAngle": -0.3, "label": "A-site", "side": "CT" },
    { "x": 400, "y": 470, "watchAngle": -1.4, "label": "T-spawn", "side": "TR" }
  ]
};
