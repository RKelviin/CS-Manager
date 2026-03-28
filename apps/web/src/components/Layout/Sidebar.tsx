import type { CSSProperties } from "react";
import { theme } from "../../theme";

export type NavItem = { key: string; label: string };

type Props = {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const { colors, spacing, typography, zIndex, radii } = theme;

export const SIDEBAR_WIDTH_EXPANDED = 260;

const MENU_BTN_SIZE = 44;
/** Altura reservada no topo da sidebar para o botão fixo (mesma posição que minimizado) */
const SIDEBAR_TOP_INSET = spacing.md + MENU_BTN_SIZE + spacing.sm;

const iconBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.md,
  background: colors.bgElevated,
  color: colors.text,
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
};

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const Sidebar = ({
  items,
  activeKey,
  onSelect,
  collapsed,
  onToggleCollapsed
}: Props) => {
  return (
    <>
      {!collapsed && (
        <aside
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: SIDEBAR_WIDTH_EXPANDED,
            height: "100vh",
            background: colors.bgElevated,
            borderRight: `1px solid ${colors.border}`,
            zIndex: zIndex.sidebar,
            padding: `${SIDEBAR_TOP_INSET}px 0 20px 0`,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            transition: "opacity 0.15s ease"
          }}
        >
          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.xs,
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden"
            }}
          >
            {items.map((item) => {
              const isActive = item.key === activeKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelect(item.key)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: `${spacing.md}px ${spacing.xl}px`,
                    textAlign: "left",
                    border: "none",
                    background: isActive ? colors.primary : "transparent",
                    color: isActive ? "#fff" : colors.textMuted,
                    fontSize: typography.fontSize.lg,
                    fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
                    cursor: "pointer"
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>
      )}
      <button
        type="button"
        onClick={onToggleCollapsed}
        title={collapsed ? "Abrir menu" : "Fechar menu"}
        aria-label={collapsed ? "Abrir menu de navegação" : "Fechar menu de navegação"}
        aria-expanded={!collapsed}
        style={{
          ...iconBtn,
          position: "fixed",
          top: spacing.md,
          left: spacing.md,
          width: MENU_BTN_SIZE,
          height: MENU_BTN_SIZE,
          zIndex: zIndex.sidebar + 1
        }}
      >
        <IconMenu />
      </button>
    </>
  );
};
