/**
 * Mapa customizado: Inferno
 * Gerado pelo Editor de mapas.
 */
import type { MapData } from "./mapTypes";

export const INFERNO_MAP: MapData = {
  "name": "Inferno",
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
      "x": 650,
      "y": 350,
      "width": 140,
      "height": 240
    },
    {
      "x": 460,
      "y": 230,
      "width": 270,
      "height": 40
    },
    {
      "x": 540,
      "y": 10,
      "width": 60,
      "height": 150
    },
    {
      "x": 200,
      "y": 360,
      "width": 250,
      "height": 50
    },
    {
      "x": 200,
      "y": 490,
      "width": 40,
      "height": 100
    },
    {
      "x": 250,
      "y": 130,
      "width": 70,
      "height": 70
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
      "name": "RED Spawn",
      "x": 300,
      "y": 500,
      "width": 200,
      "height": 80,
      "type": "spawn"
    },
    {
      "id": "spawn-ct",
      "name": "BLU Spawn",
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
    { "id": "inf-banana", "x": 720, "y": 420, "type": "choke", "side": "both", "aimAngle": -2.4 },
    { "id": "inf-apps", "x": 620, "y": 200, "type": "angle", "side": "BLU", "aimAngle": -0.5 },
    { "id": "inf-mid", "x": 400, "y": 280, "type": "choke", "side": "both", "aimAngle": -1.4 },
    { "id": "inf-site-a", "x": 700, "y": 100, "type": "cover", "side": "BLU", "aimAngle": 1.5 },
    { "id": "inf-site-b", "x": 100, "y": 100, "type": "cover", "side": "BLU", "aimAngle": 0.3 },
    { "id": "inf-pit", "x": 520, "y": 320, "type": "angle", "side": "BLU", "aimAngle": -0.9 }
  ],
  "tacticalSpots": [
    { "x": 700, "y": 380, "watchAngle": -2.2, "label": "banana", "side": "both" },
    { "x": 600, "y": 180, "watchAngle": -0.6, "label": "apps", "side": "BLU" },
    { "x": 400, "y": 250, "watchAngle": 1.55, "label": "mid", "side": "both" },
    { "x": 680, "y": 110, "watchAngle": -0.2, "label": "site-A", "side": "BLU" },
    { "x": 90, "y": 120, "watchAngle": 0.5, "label": "site-B", "side": "BLU" },
    { "x": 400, "y": 480, "watchAngle": -1.45, "label": "RED-stairs", "side": "RED" }
  ]
};
