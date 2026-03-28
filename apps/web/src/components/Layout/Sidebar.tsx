import { theme } from "../../theme";

type NavItem = { key: string; label: string };

type Props = {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

const { colors, spacing, typography, zIndex } = theme;

export const Sidebar = ({ items, activeKey, onSelect }: Props) => {
  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 260,
        height: "100vh",
        background: colors.bgElevated,
        borderRight: `1px solid ${colors.border}`,
        zIndex: zIndex.sidebar,
        paddingTop: 60,
        padding: "60px 0 20px 0"
      }}
    >
        <nav style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          {items.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <button
                key={item.key}
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
  );
};
