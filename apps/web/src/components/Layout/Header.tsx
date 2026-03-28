import { theme } from "../../theme";

type Props = {
  onUserClick: () => void;
  userName: string | null;
  isLoggedIn: boolean;
};

const { colors, spacing, radii, typography, zIndex } = theme;

export const Header = ({ onUserClick, userName, isLoggedIn }: Props) => {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${spacing.md}px ${spacing.xl}px`,
        background: colors.bgElevated,
        borderBottom: `1px solid ${colors.border}`,
        position: "sticky",
        top: 0,
        zIndex: zIndex.header
      }}
    >
      <h1 style={{ margin: 0, fontSize: typography.fontSize["3xl"], fontWeight: typography.fontWeight.bold, color: colors.text }}>
        CS Manager
      </h1>
      <button
        onClick={onUserClick}
        style={{
          padding: `${spacing.sm}px ${spacing.md}px`,
          border: "1px solid",
          borderColor: isLoggedIn ? colors.border : colors.primary,
          background: isLoggedIn ? colors.bgInput : "transparent",
          color: isLoggedIn ? colors.textMuted : colors.primary,
          borderRadius: radii.md,
          fontSize: typography.fontSize.md,
          fontWeight: isLoggedIn ? typography.fontWeight.medium : typography.fontWeight.semibold,
          cursor: "pointer"
        }}
      >
        {isLoggedIn ? userName ?? "Perfil" : "Entrar"}
      </button>
    </header>
  );
};
