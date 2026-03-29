import { useEffect, useRef } from "react";
import { DEFUSE_KIT_MS, DEFUSE_NO_KIT_MS, PLANT_TIME_MS } from "../engine/bombConstants";
import { getTeamDisplayColor, getRedSideTeamFromState } from "../engine/matchConstants";
import { getWeaponFovForRole, getWeaponRangeForRole } from "../engine/roleCombat";
import { getPlantedBombWorldPos } from "../engine/situationalBrain";
import { BOT_RADIUS, unobstructedRayDistance } from "../map/dust2Map";
import { getNavMeshNodes } from "../map/navMesh";
import type { MapData } from "../map/mapTypes";
import type { MatchState } from "../types";
import {
  drawMapHudWeaponIcon,
  drawMiniC4BadgeOnPlayer,
  drawMiniHpBar,
  getHudMapWeaponKind,
  hudMapWeaponKindFromPrimaryWeapon,
  MAP_HUD_HP_BAR_H
} from "./weaponIcons";

const MAP_WEAPON_ICON_C4 = "#e8b84a";

import { DUST2_MAP } from "../map/dust2Map";

/** Segmentos angulares do cone — mais = borda mais suave, custo O(n·paredes) */
const VISIBLE_CONE_SEGMENTS = 44;

function fillWallClippedVisionCone(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  ox: number,
  oy: number,
  angleCenter: number,
  halfAngleRad: number,
  maxRadius: number,
  fillStyle: string
) {
  const a0 = angleCenter - halfAngleRad;
  const sweep = halfAngleRad * 2;
  const n = VISIBLE_CONE_SEGMENTS;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n;
    const d = unobstructedRayDistance(map, ox, oy, Math.cos(a), Math.sin(a), maxRadius);
    ctx.lineTo(ox + Math.cos(a) * d, oy + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

export type GameCanvasLabProps = {
  /** Desenha nós da malha de navegação */
  showNavMesh?: boolean;
  /** Desenha linhas navPath dos bots vivos */
  showBotNavPaths?: boolean;
  /** Clique no mapa → coordenadas no espaço do mapa (ex.: spawn na Sandbox) */
  onMapWorldClick?: (x: number, y: number) => void;
};

export const GameCanvas = ({
  state,
  lab
}: {
  state: MatchState;
  lab?: GameCanvasLabProps;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const map = state.mapData ?? DUST2_MAP;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = map.width;
    const h = map.height;

    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(10, 10, w - 20, h - 20);

    if (lab?.showNavMesh) {
      const nodes = getNavMeshNodes(map);
      ctx.fillStyle = "rgba(34, 197, 94, 0.35)";
      for (const n of nodes) {
        ctx.fillRect(n.x - 1.5, n.y - 1.5, 3, 3);
      }
    }

    map.zones.forEach((z) => {
      ctx.strokeStyle = z.type === "site" ? "#f00" : "#00f";
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(z.x, z.y, z.width, z.height);
      ctx.setLineDash([]);
      ctx.fillStyle = z.type === "site" ? "rgba(255, 0, 0, 0.06)" : "rgba(0, 0, 255, 0.06)";
      ctx.fillRect(z.x, z.y, z.width, z.height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "12px Segoe UI, sans-serif";
      ctx.fillText(z.name, z.x + 5, z.y + 15);
    });

    const tickId = state.tickId;
    state.bots.forEach((bot) => {
      if (bot.hp <= 0) return;
      const { x, y, angle, aim, team, lastFireTick } = bot;
      const isFiring = lastFireTick >= 0 && tickId - lastFireTick < 2;
      const flashAlpha = isFiring ? 0.28 : 0.05;

      const wr = getWeaponRangeForRole(bot, state);
      const wf = getWeaponFovForRole(bot);
      fillWallClippedVisionCone(
        ctx,
        map,
        x,
        y,
        angle,
        wf / 2,
        wr,
        `${getTeamDisplayColor(team, state.round, "flash", state.teamAStartsAs)}${flashAlpha})`
      );

      const precisionAngle = wf * (1 - (aim / 100) * 0.72);
      fillWallClippedVisionCone(
        ctx,
        map,
        x,
        y,
        angle,
        precisionAngle / 2,
        wr,
        `${getTeamDisplayColor(team, state.round, "aim", state.teamAStartsAs)}${isFiring ? 0.45 : 0.12})`
      );
    });

    map.walls.forEach((wall) => {
      ctx.fillStyle = "#444";
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      ctx.strokeStyle = "#555";
      ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
    });

    if (lab?.showBotNavPaths) {
      ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 4]);
      for (const bot of state.bots) {
        if (bot.hp <= 0 || !bot.navPath?.length) continue;
        ctx.beginPath();
        ctx.moveTo(bot.x, bot.y);
        for (const p of bot.navPath) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    const bombWorld = state.bombDroppedAt;
    if (bombWorld) {
      ctx.beginPath();
      ctx.arc(bombWorld.x, bombWorld.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 215, 0, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 200, 0, 0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = "18px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fde68a";
      ctx.fillText("C4", bombWorld.x, bombWorld.y);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    const kitDrops = state.defuseKitDrops ?? [];
    for (const k of kitDrops) {
      ctx.beginPath();
      ctx.arc(k.x, k.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100, 116, 139, 0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.45)";
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.font = "9px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
      ctx.fillText("kit", k.x, k.y);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    const weaponDrops = state.weaponDrops ?? [];
    for (const w of weaponDrops) {
      const dropKind = hudMapWeaponKindFromPrimaryWeapon(w.primaryWeapon);
      drawMapHudWeaponIcon(ctx, w.x, w.y, w.angle, dropKind, "rgba(203, 213, 225, 0.95)", {
        iconAnchor: "world"
      });
    }

    if (state.bombPlanted && state.bombPlantSite) {
      const p = getPlantedBombWorldPos(state)!;
      const sec = Math.ceil(state.postPlantTimeLeftMs / 1000);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "bold 14px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fecaca";
      ctx.fillText("C4", p.x, p.y - 8);
      ctx.font = "12px Segoe UI, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(`${sec}s`, p.x, p.y + 8);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    state.bots.forEach((bot) => {
      if (bot.hp <= 0) return;
      const { x, y, angle, team, name, hp, lastFireTick, hasBomb } = bot;
      const inCombat = lastFireTick >= 0 && tickId - lastFireTick < 2;
      // Nome → barra de HP → bolinha (y = centro do jogador)
      const gapNameToBar = 2;
      const gapBarToCircle = 4;
      const circleTop = y - BOT_RADIUS;
      const hpBarTop = circleTop - gapBarToCircle - MAP_HUD_HP_BAR_H;
      const nameBaselineBottom = hpBarTop - gapNameToBar;

      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(name, x, nameBaselineBottom);

      drawMiniHpBar(ctx, x, hpBarTop, hp, 100);

      ctx.beginPath();
      ctx.arc(x, y, BOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = getTeamDisplayColor(team, state.round, "dot", state.teamAStartsAs);
      ctx.fill();
      ctx.strokeStyle = inCombat
        ? getTeamDisplayColor(team, state.round, "primary", state.teamAStartsAs)
        : "#fff";
      ctx.lineWidth = inCombat ? 3.5 : 1.5;
      ctx.stroke();

      if (team === getRedSideTeamFromState(state) && hasBomb) {
        drawMiniC4BadgeOnPlayer(ctx, x, y);
      }

      const hudKind = getHudMapWeaponKind(bot, state);
      const weaponIconColor = hudKind === "c4" ? MAP_WEAPON_ICON_C4 : getTeamDisplayColor(team, state.round, "mapIcon", state.teamAStartsAs);
      drawMapHudWeaponIcon(ctx, x, y, angle, hudKind, weaponIconColor);

      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "start";
    });

    /** Relógio circular de plant/defuse sobre o ícone da bomba (desenhado por último para ficar por cima) */
    const drawCircularProgress = (cx: number, cy: number, progress: number, color: string) => {
      const R = 28;
      const lineW = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(30, 41, 59, 0.9)";
      ctx.lineWidth = lineW;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.lineCap = "round";
      ctx.stroke();
    };

    if (state.plantProgressMs > 0) {
      const carrier = state.bots.find(
        (b) => b.team === getRedSideTeamFromState(state) && b.hasBomb && b.hp > 0
      );
      if (carrier) {
        drawCircularProgress(carrier.x, carrier.y, state.plantProgressMs / PLANT_TIME_MS, "#ef4444");
      }
    } else if (state.bombPlanted && state.bombPlantSite && state.defuseProgressMs > 0 && state.defuserId) {
      const defuser = state.bots.find((b) => b.id === state.defuserId);
      const need = defuser?.hasDefuseKit ? DEFUSE_KIT_MS : DEFUSE_NO_KIT_MS;
      const p = getPlantedBombWorldPos(state)!;
      drawCircularProgress(p.x, p.y, state.defuseProgressMs / need, "#60a5fa");
    }
  }, [state, lab?.showNavMesh, lab?.showBotNavPaths]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const onWorldClick = lab?.onMapWorldClick;
    if (!canvas || !onWorldClick) return;

    const toWorld = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      const sx = map.width / r.width;
      const sy = map.height / r.height;
      return {
        x: (clientX - r.left) * sx,
        y: (clientY - r.top) * sy
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      const { x, y } = toWorld(e.clientX, e.clientY);
      onWorldClick(x, y);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    return () => canvas.removeEventListener("pointerdown", onPointerDown);
  }, [lab?.onMapWorldClick, map.width, map.height]);

  const spawnActive = lab?.onMapWorldClick != null;

  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 12,
        background: "linear-gradient(180deg, #0f1419 0%, #0c1017 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 28px rgba(0,0,0,0.35)"
      }}
    >
      <canvas
        ref={canvasRef}
        width={map.width}
        height={map.height}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: 8,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
          cursor: spawnActive ? "crosshair" : undefined,
          touchAction: spawnActive ? "none" : undefined
        }}
      />
    </div>
  );
};
