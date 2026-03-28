import { AuthPage } from "./pages/AuthPage";
import { BoosterPackPage } from "./pages/BoosterPackPage";
import { ChampionshipPage } from "./pages/ChampionshipPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MapEditorPage } from "./pages/MapEditorPage";
import { MarketPage } from "./pages/MarketPage";
import { RankingPage } from "./pages/RankingPage";
import { LiveMatchesPage } from "./pages/LiveMatchesPage";
import { SimulationPage } from "./pages/SimulationPage";
import { StrategiesPage } from "./pages/StrategiesPage";
import { TeamPage } from "./pages/TeamPage";
import { UserPage } from "./pages/UserPage";
import { AuthProvider, useAuth } from "./features/auth";
import { TeamProvider } from "./features/team";
import { MarketProvider } from "./features/market";
import { MatchProvider } from "./features/replay";
import { Header, Sidebar, SIDEBAR_WIDTH_EXPANDED } from "./components/Layout";
import { theme } from "./theme";
import { useCallback, useMemo, useState } from "react";

const { colors, spacing, radii } = theme;

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "team", label: "Meu time" },
  { key: "market", label: "Mercado" },
  { key: "boosterpack", label: "Booster Packs" },
  { key: "championships", label: "Campeonatos" },
  { key: "livematches", label: "Partidas ao vivo" },
  { key: "simulation", label: "Simulação" },
  { key: "strategies", label: "Estratégias" },
  { key: "ranking", label: "Ranking" },
  { key: "mapeditor", label: "Editor de mapas" }
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"] | "auth" | "user";

const AppContent = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavKey>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleWatchMatch = useCallback((matchId: string) => {
    setActiveTab("simulation");
  }, []);

  const activeContent = useMemo(() => {
    if (activeTab === "auth") return <AuthPage />;
    if (activeTab === "user") return <UserPage />;
    if (activeTab === "team") return <TeamPage />;
    if (activeTab === "simulation") return <SimulationPage />;
    if (activeTab === "strategies") return <StrategiesPage />;
    if (activeTab === "livematches") return <LiveMatchesPage />;
    if (activeTab === "championships") return <ChampionshipPage />;
    if (activeTab === "market") return <MarketPage />;
    if (activeTab === "boosterpack") return <BoosterPackPage />;
    if (activeTab === "ranking") return <RankingPage />;
    if (activeTab === "mapeditor") return <MapEditorPage />;
    return <DashboardPage />;
  }, [activeTab]);

  const handleUserClick = () => {
    if (user) setActiveTab("user");
    else setActiveTab("auth");
  };

  const contentMaxWidth =
    activeTab === "simulation" ||
    activeTab === "livematches" ||
    activeTab === "championships" ||
    activeTab === "mapeditor"
      ? 1520
      : 800;

  const sidebarWidth = sidebarCollapsed ? 0 : SIDEBAR_WIDTH_EXPANDED;
  /** 44px botão + 8px respiro alinhado ao padding do header */
  const headerMenuInset = sidebarCollapsed ? 52 : 0;

  return (
    <main
      style={{
        fontFamily: theme.typography.fontFamily,
        minHeight: "100vh",
        background: colors.bg,
        color: colors.text
      }}
    >
      <Sidebar
        items={[...NAV_ITEMS]}
        activeKey={NAV_ITEMS.some((n) => n.key === activeTab) ? activeTab : "dashboard"}
        onSelect={(key) => setActiveTab(key as NavKey)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      />
      <div
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 0.2s ease"
        }}
      >
        <Header
          onUserClick={handleUserClick}
          userName={user?.name ?? null}
          isLoggedIn={!!user}
          leadingInsetPx={headerMenuInset}
        />
        <div
          style={{
            padding: spacing["2xl"],
            maxWidth: contentMaxWidth,
            margin: "0 auto"
          }}
        >
        <TeamProvider>
          <MarketProvider>
            <MatchProvider onWatchMatch={handleWatchMatch}>
            <section
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radii.xl,
                padding: spacing["2xl"],
                background: colors.bgElevated
              }}
            >
              {!isLoading && activeContent}
            </section>
            </MatchProvider>
          </MarketProvider>
        </TeamProvider>
        </div>
      </div>
    </main>
  );
};

export const App = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);
