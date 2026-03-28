import type { CSSProperties } from "react";
import { getTrTeamFromState } from "../engine/matchConstants";
import { BOT_RADIUS } from "../map/dust2Map";
import type { ArmorLoadout, Bot, MatchState, TeamSide } from "../types";

export type WeaponKind = "rifle" | "budget_rifle" | "sniper" | "smg" | "pistol";

const normalize = (name: string) => name.toLowerCase().trim();

/** Classifica arma para ícone e combate. Galil/FAMAS = budget_rifle (intermediário). */
export const weaponKind = (name: string): WeaponKind => {
  const n = normalize(name);
  if (n.includes("awp") || n.includes("ssg")) return "sniper";
  if (n.includes("mac-10") || n.includes("mac") || n.includes("mp9") || n.includes("ump")) return "smg";
  if (n.includes("galil") || n.includes("famas")) return "budget_rifle";
  if (
    n.includes("glock") ||
    n.includes("usp") ||
    n.includes("p250") ||
    n.includes("deagle") ||
    n.includes("tec-9") ||
    n.includes("cz75")
  )
    return "pistol";
  return "rifle";
};

/** Tier para comparação de upgrade (alinhado a economia / roundAdvance). Pistola = 0. */
export const weaponTierValue = (name: string): number => {
  const k = weaponKind(name);
  return k === "sniper" ? 4 : k === "rifle" ? 3 : k === "budget_rifle" ? 2 : k === "smg" ? 1 : 0;
};

/** Icone da arma no mapa (HUD compacto ao lado do jogador) */
export type HudMapWeaponKind = "c4" | "awp" | "rifle" | "smg" | "pistol" | "knife";

/**
 * C4 só no HUD enquanto está a plantar (bomba na mão). Resto do round: ícone da primária.
 */
/** Classificação de ícone no mapa só a partir do nome da arma (ex.: drops no chão). */
export function hudMapWeaponKindFromPrimaryWeapon(weapon: string): HudMapWeaponKind {
  const n = normalize(weapon);
  if (n.includes("knife") || n.includes("faca")) return "knife";
  if (n.includes("awp")) return "awp";
  const k = weaponKind(weapon);
  if (k === "sniper") return "awp";
  if (k === "smg") return "smg";
  if (k === "pistol") return "pistol";
  return "rifle";
}

export function getHudMapWeaponKind(bot: Bot, state: MatchState): HudMapWeaponKind {
  const isPlanting =
    bot.team === getTrTeamFromState(state) && bot.hasBomb && bot.hp > 0 && !state.bombPlanted && state.plantProgressMs > 0;
  if (isPlanting) return "c4";
  return hudMapWeaponKindFromPrimaryWeapon(bot.primaryWeapon);
}

/** Dimensões da barra de HP no mapa (para alinhar layout no GameCanvas) */
export const MAP_HUD_HP_BAR_W = 24;
export const MAP_HUD_HP_BAR_H = 3;

/** Barra de vida mini no mapa (compacta) — `topY` = topo da barra */
export function drawMiniHpBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  hp: number,
  maxHp = 100
) {
  const w = MAP_HUD_HP_BAR_W;
  const h = MAP_HUD_HP_BAR_H;
  const r = 1;
  const x = cx - w / 2;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const roundRect = (rx: number, ry: number, rw: number, rh: number, rad: number) => {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, rad);
    } else {
      const rr = Math.min(rad, rw / 2, rh / 2);
      ctx.beginPath();
      ctx.moveTo(rx + rr, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
      ctx.arcTo(rx, ry + rh, rx, ry, rr);
      ctx.arcTo(rx, ry, rx + rw, ry, rr);
      ctx.closePath();
    }
  };

  roundRect(x, topY, w, h, r);
  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fill();
  roundRect(x, topY, w, h, r);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const fillW = w * ratio;
  if (fillW > 0.5) {
    const grd = ctx.createLinearGradient(x, topY, x + fillW, topY);
    grd.addColorStop(0, "#4ade80");
    grd.addColorStop(0.5, "#facc15");
    grd.addColorStop(1, "#f87171");
    ctx.fillStyle = grd;
    roundRect(x, topY, fillW, h, r);
    ctx.fill();
  }
}

/** Distintivo C4 no centro da bolinha do jogador (mapa), quando é portador */
export function drawMiniC4BadgeOnPlayer(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.4, 0.4);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.5)";
  ctx.fillStyle = "#fde68a";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-10, 6);
  ctx.lineTo(10, 6);
  ctx.lineTo(11, 4);
  ctx.lineTo(11, -4);
  ctx.lineTo(10, -6);
  ctx.lineTo(-10, -6);
  ctx.lineTo(-11, -4);
  ctx.lineTo(-11, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, -11);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -13, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#fde68a";
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Ícones de arma no mapa (vetor desenhado no canvas).
 *
 * Para trocar por arte mais polida no futuro:
 * - **SVG inline / assets**: exportar de Figma/Illustrator; usar `Path2D` + `ctx.stroke()` ou
 *   carregar `new Image()` com PNG/SVG e `ctx.drawImage` (melhor qualidade anti-alias).
 * - **Bibliotecas gratuitas (ver licença de cada ícone)**:
 *   - [game-icons.net](https://game-icons.net) — CC BY 3.0, estilo jogo.
 *   - [Phosphor](https://phosphoricons.com) / [Lucide](https://lucide.dev) / [Heroicons](https://heroicons.com) — MIT.
 *   - [OpenGameArt.org](https://opengameart.org) — várias licenças (filtrar por CC0/CC-BY).
 * - **Não** usar ícones de jogos comerciais (CS2 etc.) sem licença explícita.
 *
 * Posição: por defeito centro do ícone no **lado direito** do jogador (vista de cima); rotação = mira (`aimRad`).
 * Com `iconAnchor: "world"`, o centro fica em `(playerX, playerY)` (ex.: arma no chão).
 * Os traços têm coronha à esquerda / cano à direita em +X local; espelha em X para alinhar ao `angle` do motor.
 */
export function drawMapHudWeaponIcon(
  ctx: CanvasRenderingContext2D,
  playerX: number,
  playerY: number,
  aimRad: number,
  kind: HudMapWeaponKind,
  color: string,
  opts?: { iconAnchor?: "beside_player" | "world" }
) {
  const anchor = opts?.iconAnchor ?? "beside_player";
  /** Distância do centro do jogador ao centro do ícone (empunhadura à direita, junto à bolinha) */
  const distFromCenter = BOT_RADIUS + 4;
  /** Perpendicular à mira: lado direito do corpo em coordenadas do canvas */
  const ix =
    anchor === "world" ? playerX : playerX + distFromCenter * (-Math.sin(aimRad));
  const iy = anchor === "world" ? playerY : playerY + distFromCenter * Math.cos(aimRad);

  ctx.save();
  ctx.translate(ix, iy);
  ctx.rotate(aimRad);
  /** Inverte o eixo X local (espelha a arma): ponta/cano na direção da mira */
  ctx.scale(-1, 1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const dim = (a: number) => {
    ctx.save();
    ctx.globalAlpha = a;
  };
  const endDim = () => ctx.restore();

  /** Escala: coordenadas ~±24; tamanho final ~no mapa ao lado do BOT */
  ctx.scale(0.48, 0.48);

  switch (kind) {
    case "c4": {
      // Caixa + teclado + fio
      ctx.beginPath();
      ctx.moveTo(-11, 7);
      ctx.lineTo(11, 7);
      ctx.lineTo(13, 5);
      ctx.lineTo(13, -5);
      ctx.lineTo(11, -7);
      ctx.lineTo(-11, -7);
      ctx.lineTo(-13, -5);
      ctx.lineTo(-13, 5);
      ctx.closePath();
      dim(0.3);
      ctx.fillStyle = color;
      ctx.fill();
      endDim();
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          ctx.arc(-6 + i * 6, -1 + j * 4, 1.1, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(0, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -14, 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "knife": {
      // Lâmina + gume + cabo
      ctx.beginPath();
      ctx.moveTo(-12, 6);
      ctx.lineTo(10, -8);
      ctx.lineTo(12, -4);
      ctx.lineTo(12, 0);
      ctx.lineTo(-8, 10);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      dim(0.22);
      ctx.fill();
      endDim();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(6, -10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-14, 8);
      ctx.lineTo(-10, 10);
      ctx.lineTo(-12, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-16, 10);
      ctx.lineTo(-12, 12);
      ctx.stroke();
      break;
    }
    case "awp": {
      // Coronha, corpo, cano longo, scope em dois anéis
      ctx.beginPath();
      ctx.moveTo(-24, 5);
      ctx.lineTo(-24, 11);
      ctx.lineTo(-18, 11);
      ctx.lineTo(-14, 7);
      ctx.lineTo(6, 7);
      ctx.lineTo(10, 3);
      ctx.lineTo(22, 3);
      ctx.lineTo(24, 1);
      ctx.lineTo(24, -1);
      ctx.lineTo(22, -3);
      ctx.lineTo(10, -3);
      ctx.lineTo(6, -7);
      ctx.lineTo(-14, -7);
      ctx.lineTo(-18, -3);
      ctx.lineTo(-22, -3);
      ctx.closePath();
      dim(0.18);
      ctx.fill();
      endDim();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(14, -9, 4, 3.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(14, -9, 1.8, 1.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, 3);
      ctx.lineTo(22, 3);
      ctx.stroke();
      break;
    }
    case "smg": {
      // Corpo curto, carregador vertical, trilho superior
      ctx.beginPath();
      ctx.moveTo(-18, 3);
      ctx.lineTo(8, 3);
      ctx.lineTo(12, -1);
      ctx.lineTo(16, -1);
      ctx.lineTo(18, 1);
      ctx.lineTo(18, 7);
      ctx.lineTo(12, 7);
      ctx.lineTo(8, 11);
      ctx.lineTo(-18, 11);
      ctx.closePath();
      dim(0.2);
      ctx.fill();
      endDim();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, 11);
      ctx.lineTo(4, 18);
      ctx.lineTo(8, 18);
      ctx.lineTo(10, 11);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10, -1);
      ctx.lineTo(4, -1);
      ctx.stroke();
      break;
    }
    case "pistol": {
      // Corrediça, guarda-mato, empunhadura
      ctx.beginPath();
      ctx.moveTo(-10, 4);
      ctx.lineTo(6, 4);
      ctx.lineTo(12, 0);
      ctx.lineTo(14, 0);
      ctx.lineTo(14, 6);
      ctx.lineTo(8, 6);
      ctx.lineTo(4, 10);
      ctx.lineTo(-4, 10);
      ctx.lineTo(-8, 14);
      ctx.lineTo(-12, 14);
      ctx.lineTo(-12, 8);
      ctx.closePath();
      dim(0.2);
      ctx.fill();
      endDim();
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-2 + i * 2.5, 4);
        ctx.lineTo(-1 + i * 2.5, 1);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(2, 7, 2.5, 0.2, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    default: {
      // Rifle (coronha + corpo + carregador curvo)
      ctx.beginPath();
      ctx.moveTo(-22, 4);
      ctx.lineTo(-22, 10);
      ctx.lineTo(-16, 10);
      ctx.lineTo(-12, 6);
      ctx.lineTo(8, 6);
      ctx.lineTo(14, 2);
      ctx.lineTo(20, 2);
      ctx.lineTo(22, 4);
      ctx.lineTo(22, 8);
      ctx.lineTo(16, 8);
      ctx.lineTo(10, 12);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      dim(0.18);
      ctx.fill();
      endDim();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, 12);
      ctx.quadraticCurveTo(0, 20, 6, 20);
      ctx.lineTo(8, 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6, 2);
      ctx.lineTo(4, 2);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

const svgProps = { viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" as const };

/** Icone SVG compacto para paineis */
/** Colete / colete+cap ao lado do nome no painel */
export const ArmorLoadoutIcons = ({
  armor,
  size = 16,
  style
}: {
  armor: ArmorLoadout;
  size?: number;
  style?: CSSProperties;
}) => {
  if (armor === "none") return null;
  const stroke = "currentColor";
  const common = { stroke, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const title = armor === "vest_helmet" ? "Colete + capacete" : "Colete";
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#94a3b8", flexShrink: 0, ...style }}
      title={title}
      aria-label={title}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
        <title>{title}</title>
        <path {...common} d="M7 6h10l2.5 3v7l-2.5 3H7l-2.5-3V9L7 6z" />
        <path {...common} d="M9 10h6M9 14h4" />
      </svg>
      {armor === "vest_helmet" && (
        <svg width={size * 0.95} height={size * 0.95} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
          <title>Capacete</title>
          <path {...common} d="M12 4c-3 0-5.5 2-5.5 5v2h11V9c0-3-2.5-5-5.5-5z" />
          <path {...common} d="M6.5 11v3c0 2.5 2 4.5 5.5 4.5s5.5-2 5.5-4.5v-3" />
        </svg>
      )}
    </span>
  );
};

/** C4 no inventário (TR) — ao lado do colete/capacete quando é portador */
export const CarryC4Icon = ({
  size = 14,
  style
}: {
  size?: number;
  style?: CSSProperties;
}) => {
  const stroke = "currentColor";
  const common = { stroke, strokeWidth: 1.35, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const title = "Portador da C4";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        color: "#e8b84a",
        flexShrink: 0,
        ...style
      }}
      title={title}
      aria-label={title}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
        <title>{title}</title>
        <path
          fill="rgba(232, 184, 74, 0.2)"
          stroke={stroke}
          strokeWidth={1.35}
          strokeLinejoin="round"
          d="M6 15h12l1.5-1v-8l-1.5-1H6l-1.5 1v8l1.5 1z"
        />
        <path {...common} d="M8 9.5h3M11 9.5h3M8 12h8" />
        <path {...common} d="M12 7V4" />
        <circle cx="12" cy="2.5" r="1.8" stroke={stroke} strokeWidth={1.35} fill="none" />
      </svg>
    </span>
  );
};

/** Kit de desarme (CT) — ao lado do colete/cap no painel (discreto) */
export const DefuseKitIcon = ({
  size = 12,
  style
}: {
  size?: number;
  style?: CSSProperties;
}) => {
  const stroke = "currentColor";
  const common = { stroke, strokeWidth: 1.25, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const title = "Kit de desarme (defuse 5s)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        color: "#64748b",
        opacity: 0.88,
        flexShrink: 0,
        ...style
      }}
      title={title}
      aria-label={title}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
        <title>{title}</title>
        <path {...common} d="M5 15l5-9 2 1.5-4 8.5H5z" />
        <path {...common} d="M19 15l-5-9-2 1.5 4 8.5H19z" />
        <path {...common} d="M10 17h4" />
      </svg>
    </span>
  );
};

export const WeaponIcon = ({
  weapon,
  size = 22,
  style,
  label
}: {
  weapon: string;
  size?: number;
  style?: CSSProperties;
  /** Acessibilidade */
  label?: string;
}) => {
  const k = weaponKind(weapon);
  const stroke = "currentColor";
  const common = { stroke, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  const body = (() => {
    switch (k) {
      case "sniper":
        return (
          <>
            <path {...common} d="M3 14h8l2-2 4-1 4 1v2h-3l-1 2H3v-2z" />
            <circle cx="18" cy="11" r="2.2" />
            <path {...common} d="M5 14v3M11 12l2-2" />
          </>
        );
      case "smg":
        return (
          <>
            <path {...common} d="M4 13h10l2-1h4v2h-4l-1 2H4v-3z" />
            <path {...common} d="M6 16v2M14 11l2-1" />
          </>
        );
      case "pistol":
        return (
          <>
            <path {...common} d="M6 14h8l2-1 2 1v3H8l-2-1v-3z" />
            <path {...common} d="M8 17v2" />
          </>
        );
      default:
        return (
          <>
            <path {...common} d="M3 13h12l3-1h4v2h-4l-2 2H3v-3z" />
            <path {...common} d="M5 16v2M14 11l2-1" />
          </>
        );
    }
  })();

  return (
    <svg
      width={size}
      height={size}
      {...svgProps}
      style={{ flexShrink: 0, color: "#94a3b8", ...style }}
      aria-label={label ?? weapon}
      role="img"
    >
      <title>{label ?? weapon}</title>
      {body}
    </svg>
  );
};

/** Desenha mini-icone no canvas abaixo do jogador */
export function drawWeaponOnCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  primaryWeapon: string,
  color: string,
  opts?: { hudOffsetY?: number; rotation?: number; scale?: number }
) {
  const k = weaponKind(primaryWeapon);
  const hudOffsetY = opts?.hudOffsetY ?? 16;
  const rotation = opts?.rotation ?? 0;
  const scale = opts?.scale ?? 0.55;
  ctx.save();
  ctx.translate(cx, cy + hudOffsetY);
  if (rotation !== 0) ctx.rotate(rotation);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.35;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.scale(scale, scale);

  const strokePath = () => {
    ctx.beginPath();
    switch (k) {
      case "sniper":
        ctx.moveTo(-18, 0);
        ctx.lineTo(10, 0);
        ctx.lineTo(14, -4);
        ctx.lineTo(20, -4);
        ctx.lineTo(22, 0);
        ctx.lineTo(18, 4);
        ctx.lineTo(8, 4);
        ctx.lineTo(4, 8);
        ctx.lineTo(-18, 8);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(16, -6, 3, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "smg":
        ctx.moveTo(-16, 4);
        ctx.lineTo(12, 4);
        ctx.lineTo(16, 0);
        ctx.lineTo(20, 0);
        ctx.lineTo(20, 6);
        ctx.lineTo(14, 6);
        ctx.lineTo(10, 10);
        ctx.lineTo(-16, 10);
        ctx.closePath();
        ctx.stroke();
        break;
      case "pistol":
        ctx.moveTo(-8, 6);
        ctx.lineTo(8, 6);
        ctx.lineTo(12, 2);
        ctx.lineTo(14, 2);
        ctx.lineTo(14, 10);
        ctx.lineTo(4, 10);
        ctx.lineTo(0, 14);
        ctx.lineTo(-8, 14);
        ctx.closePath();
        ctx.stroke();
        break;
      default:
        ctx.moveTo(-18, 4);
        ctx.lineTo(14, 4);
        ctx.lineTo(18, 0);
        ctx.lineTo(22, 0);
        ctx.lineTo(22, 6);
        ctx.lineTo(16, 6);
        ctx.lineTo(12, 10);
        ctx.lineTo(-18, 10);
        ctx.closePath();
        ctx.stroke();
        break;
    }
  };
  strokePath();
  ctx.restore();
}

/** Mini colete (canvas) — alinhado ao icone SVG do painel */
const strokeVestMini = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.lineTo(5, -5);
  ctx.lineTo(6.5, -2);
  ctx.lineTo(6.5, 6);
  ctx.lineTo(-6.5, 6);
  ctx.lineTo(-6.5, -2);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(3, 0);
  ctx.moveTo(-3, 3);
  ctx.lineTo(2, 3);
  ctx.stroke();
};

/** Mini capacete (canvas) */
const strokeHelmetMini = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.arc(0, -1, 5.5, Math.PI * 0.85, Math.PI * 0.15, true);
  ctx.lineTo(4, 4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.stroke();
};

/** Mini kit de desarme (canvas) */
const strokeKitMini = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(-5, 4);
  ctx.lineTo(-1, -5);
  ctx.lineTo(1, -4);
  ctx.lineTo(-2, 5);
  ctx.lineTo(-5, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5, 4);
  ctx.lineTo(1, -5);
  ctx.lineTo(-1, -4);
  ctx.lineTo(2, 5);
  ctx.lineTo(5, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, 6);
  ctx.lineTo(2, 6);
  ctx.stroke();
};

/**
 * HUD no mapa: colete, capacete (se houver) e kit CT — fila centrada abaixo do nome/HP.
 */
export function drawArmorKitOnCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  rowY: number,
  armor: ArmorLoadout,
  team: TeamSide,
  hasDefuseKit: boolean
) {
  if (armor === "none" && !(team === "BLU" && hasDefuseKit)) return;

  type DrawFn = (ctx: CanvasRenderingContext2D) => void;
  const steps: { color: string; draw: DrawFn }[] = [];

  if (armor !== "none") {
    steps.push({ color: "#94a3b8", draw: strokeVestMini });
    if (armor === "vest_helmet") {
      steps.push({ color: "#94a3b8", draw: strokeHelmetMini });
    }
  }
  if (team === "BLU" && hasDefuseKit) {
    steps.push({ color: "rgba(100, 116, 139, 0.75)", draw: strokeKitMini });
  }

  const gap = 3;
  const slotW = 14;
  const total = steps.length * slotW + (steps.length - 1) * gap;
  let x = cx - total / 2 + slotW / 2;

  for (const s of steps) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = s.color;
    ctx.translate(x, rowY);
    s.draw(ctx);
    ctx.restore();
    x += slotW + gap;
  }
}
