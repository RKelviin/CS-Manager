import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode
} from "react";
import { userTeam } from "../../shared/mvpMock";
import { useAuth } from "../auth";
import { api } from "../../shared/apiClient";
import type { ApiTeam } from "./apiTypes";
import type { BotPlayer, UserTeam } from "./types";
import { loadTeam, saveTeam } from "./teamStorage";

const toBotPlayer = (p: (typeof userTeam.starters)[0]): BotPlayer => ({
  ...p,
  kills: 0,
  deaths: 0,
  assists: 0
});

const defaultTeam: UserTeam = {
  name: userTeam.name,
  record: { ...userTeam.record },
  starters: userTeam.starters.map(toBotPlayer),
  bench: userTeam.bench.map(toBotPlayer)
};

function apiTeamToUserTeam(apiTeam: ApiTeam): UserTeam {
  const starters: BotPlayer[] = [];
  const bench: BotPlayer[] = [];
  for (const p of apiTeam.players) {
    const bp: BotPlayer = {
      id: p.id,
      name: p.name,
      role: p.role,
      aim: p.aim,
      reflex: p.reflex,
      decision: p.decision,
      composure: p.composure,
      isStarter: p.isStarter,
      nationality: p.nationality ?? undefined,
      avatarUrl: p.avatarUrl ?? undefined,
      kills: 0,
      deaths: 0,
      assists: 0
    };
    if (p.isStarter) starters.push(bp);
    else bench.push(bp);
  }
  starters.sort((a, b) => a.id.localeCompare(b.id));
  bench.sort((a, b) => a.id.localeCompare(b.id));
  return {
    name: apiTeam.name,
    record: { wins: apiTeam.wins, losses: apiTeam.losses },
    starters,
    bench
  };
}

const updatePlayerInList = (list: BotPlayer[], id: string, updater: (p: BotPlayer) => BotPlayer) =>
  list.map((p) => (p.id === id ? updater(p) : p));

type TeamContextValue = {
  team: UserTeam;
  teamId: string | null;
  isFromApi: boolean;
  refreshTeam: () => Promise<void>;
  swapPlayers: (starter: BotPlayer, benchPlayer: BotPlayer) => void;
  updateTeamName: (name: string) => void;
  updateTeamRecord: (record: { wins: number; losses: number }) => void;
  updatePlayer: (playerId: string, updates: Partial<BotPlayer>) => void;
  addPlayer: (player: BotPlayer, asStarter: boolean) => void;
  removePlayer: (playerId: string) => void;
};

const TeamContext = createContext<TeamContextValue | null>(null);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [team, setTeam] = useState<UserTeam>(() => loadTeam(defaultTeam));
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isFromApi, setIsFromApi] = useState(false);

  useEffect(() => {
    if (!user) {
      const loaded = loadTeam(defaultTeam);
      setTeam(loaded);
      setTeamId(null);
      setIsFromApi(false);
      return;
    }
    let cancelled = false;
    api
      .get<ApiTeam[]>("/team")
      .then((teams) => {
        if (cancelled) return;
        const t = teams[0];
        if (t) {
          setTeam(apiTeamToUserTeam(t));
          setTeamId(t.id);
          setIsFromApi(true);
        } else {
          setTeam(defaultTeam);
          setTeamId(null);
          setIsFromApi(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTeam(loadTeam(defaultTeam));
          setTeamId(null);
          setIsFromApi(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isFromApi) saveTeam(team);
  }, [team, isFromApi]);

  const refreshTeam = useCallback(async () => {
    if (!user) return;
    try {
      const teams = await api.get<ApiTeam[]>("/team");
      const t = teams[0];
      if (t) {
        setTeam(apiTeamToUserTeam(t));
        setTeamId(t.id);
        setIsFromApi(true);
      }
    } catch {
      // ignore
    }
  }, [user?.id]);

  const swapPlayers = useCallback(
    async (starter: BotPlayer, benchPlayer: BotPlayer) => {
      const optimistic = (prev: UserTeam) => {
        const newStarters = prev.starters.map((s) =>
          s.id === starter.id ? { ...benchPlayer, isStarter: true } : s
        );
        const newBench = prev.bench.map((b) =>
          b.id === benchPlayer.id ? { ...starter, isStarter: false } : b
        );
        return { ...prev, starters: newStarters, bench: newBench };
      };
      setTeam(optimistic);
      if (teamId && isFromApi) {
        try {
          await api.patch(`/team/${teamId}/players/${starter.id}`, { isStarter: false });
          await api.patch(`/team/${teamId}/players/${benchPlayer.id}`, { isStarter: true });
          const [teams] = await api.get<ApiTeam[]>("/team");
          if (teams) setTeam(apiTeamToUserTeam(teams));
        } catch {
          const [teams] = await api.get<ApiTeam[]>("/team").catch(() => [null]);
          if (teams) setTeam(apiTeamToUserTeam(teams));
        }
      }
    },
    [teamId, isFromApi]
  );

  const updateTeamName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (teamId && isFromApi) {
        try {
          await api.patch(`/team/${teamId}`, { name: trimmed });
        } catch {
          // fallback to local
        }
      }
      setTeam((prev) => ({ ...prev, name: trimmed || prev.name }));
    },
    [teamId, isFromApi]
  );

  const updateTeamRecord = useCallback(
    async (record: { wins: number; losses: number }) => {
      if (teamId && isFromApi) {
        try {
          await api.patch(`/team/${teamId}`, { wins: record.wins, losses: record.losses });
        } catch {
          // fallback to local
        }
      }
      setTeam((prev) => ({ ...prev, record }));
    },
    [teamId, isFromApi]
  );

  const updatePlayer = useCallback(
    async (playerId: string, updates: Partial<BotPlayer>) => {
      if (teamId && isFromApi) {
        try {
          const body: Record<string, unknown> = {};
          if (updates.name != null) body.name = updates.name;
          if (updates.role != null) body.role = updates.role;
          if (updates.aim != null) body.aim = updates.aim;
          if (updates.reflex != null) body.reflex = updates.reflex;
          if (updates.decision != null) body.decision = updates.decision;
          if (updates.composure != null) body.composure = updates.composure;
          if (updates.isStarter != null) body.isStarter = updates.isStarter;
          if (updates.nationality != null) body.nationality = updates.nationality;
          if (Object.keys(body).length > 0) {
            await api.patch(`/team/${teamId}/players/${playerId}`, body);
          }
        } catch {
          // fallback to local
        }
      }
      setTeam((prev) => {
        const updater = (p: BotPlayer) => (p.id === playerId ? { ...p, ...updates } : p);
        return {
          ...prev,
          starters: updatePlayerInList(prev.starters, playerId, updater),
          bench: updatePlayerInList(prev.bench, playerId, updater)
        };
      });
    },
    [teamId, isFromApi]
  );

  const addPlayer = useCallback(
    async (player: BotPlayer, asStarter: boolean) => {
      if (teamId && isFromApi) {
        try {
          await api.post(`/team/${teamId}/players`, {
            name: player.name,
            role: player.role,
            aim: player.aim,
            reflex: player.reflex,
            decision: player.decision,
            composure: player.composure,
            isStarter: asStarter,
            nationality: player.nationality ?? undefined
          });
          const [teams] = await api.get<ApiTeam[]>("/team");
          if (teams) setTeam(apiTeamToUserTeam(teams));
          return;
        } catch {
          // fallback to local
        }
      }
      setTeam((prev) => {
        if (asStarter && prev.starters.length >= 5) return prev;
        const newPlayer = { ...player, isStarter: asStarter };
        if (asStarter) {
          return { ...prev, starters: [...prev.starters, newPlayer] };
        }
        return { ...prev, bench: [...prev.bench, newPlayer] };
      });
    },
    [teamId, isFromApi]
  );

  const removePlayer = useCallback(
    async (playerId: string) => {
      if (teamId && isFromApi) {
        try {
          await api.delete(`/team/${teamId}/players/${playerId}`);
        } catch {
          // fallback to local
        }
      }
      setTeam((prev) => ({
        ...prev,
        starters: prev.starters.filter((p) => p.id !== playerId),
        bench: prev.bench.filter((p) => p.id !== playerId)
      }));
    },
    [teamId, isFromApi]
  );

  return (
    <TeamContext.Provider
      value={{
        team,
        teamId,
        isFromApi,
        refreshTeam,
        swapPlayers,
        updateTeamName,
        updateTeamRecord,
        updatePlayer,
        addPlayer,
        removePlayer
      }}
    >
      {children}
    </TeamContext.Provider>
  );
};

export const useTeamContext = () => {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeamContext must be used within TeamProvider");
  return ctx;
};
