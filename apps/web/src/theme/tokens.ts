/**
 * Design tokens — paleta de cores, espaçamento, tipografia.
 * Fonte única para facilitar alterações visuais. Use tokens em vez de valores hardcoded.
 *
 * Uso:
 *   import { theme } from "../theme";
 *   style={{ background: theme.colors.bg, color: theme.colors.text }}
 *
 * Para variáveis CSS globais (index.css), os nomes seguem --csm-*
 */

export const theme = {
  colors: {
    /** Fundo principal da página */
    bg: "#0f1115",
    /** Fundo de cards, header, sidebar */
    bgElevated: "#131824",
    /** Fundo de inputs, botões secundários */
    bgInput: "#171b23",
    /** Fundo de modais, áreas destacadas */
    bgModal: "linear-gradient(165deg, #111722 0%, #0c1018 100%)",
    /** Fundo de cards internos */
    bgCard: "linear-gradient(165deg, #111722 0%, #0c1018 100%)",

    /** Borda padrão */
    border: "#2a3142",
    /** Borda mais forte (inputs, hovers) */
    borderStrong: "#334155",
    /** Borda inputs/selects */
    borderInput: "#475569",

    /** Texto principal */
    text: "#eef2ff",
    /** Texto secundário */
    textSecondary: "#e2e8f0",
    /** Texto em labels, descrições */
    textMuted: "#94a3b8",
    /** Texto desabilitado ou terciário */
    textDim: "#64748b",

    /** Cor primária (links, botões, ativo) */
    primary: "#2f6df6",
    /** Primária hover/claro */
    primaryLight: "#60a5fa",
    /** Azul alternativo */
    accent: "#3b82f6",

    /** Sucesso (green) */
    success: "#22c55e",
    /** Erro (red) */
    error: "#f87171",
    /** Aviso (yellow) */
    warning: "#fbbf24",
    /** Moeda/destaque */
    gold: "#fbbf24",

    /** Overlay escuro (modal backdrop) */
    overlay: "rgba(0,0,0,0.5)"
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32
  },

  radii: {
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12
  },

  typography: {
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif",
    fontSize: {
      xs: 11,
      sm: 12,
      base: 13,
      md: 14,
      lg: 15,
      xl: 16,
      "2xl": 18,
      "3xl": 20
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },

  zIndex: {
    header: 100,
    overlay: 198,
    sidebar: 200
  }
} as const;

export type Theme = typeof theme;
