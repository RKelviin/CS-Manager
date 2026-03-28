import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore
} from "react";
import { matchRegistry } from "./matchRegistry";
import type { MatchSetup, MatchState } from "../types";

type MatchContextValue = {
  /** Inicia uma nova partida no registry. Retorna o ID para assistir em outras telas. */
  startMatch: (setup: MatchSetup) => string;
  /** Lista IDs de partidas ativas */
  listMatchIds: () => string[];
  /** Remove partida do registry */
  removeMatch: (id: string) => void;
  /** Remove partidas já finalizadas e limpa URL se o ID assistido deixou de existir */
  cleanupRegistry: () => void;
  /** ID da partida sendo assistida (null = criar nova) */
  watchedMatchId: string | null;
  /** Define partida para assistir e opcionalmente navega para a tela de simulação */
  watchMatch: (id: string | null) => void;
};

const MatchContext = createContext<MatchContextValue | null>(null);

type MatchProviderProps = {
  children: React.ReactNode;
  /** Chamado quando watchMatch(id) é invocado com id não nulo — permite trocar de aba para simulação */
  onWatchMatch?: (matchId: string) => void;
};

/** Provider que permite partidas em background. Envolver o app ou a área de simulação. */
export const MatchProvider = ({ children, onWatchMatch }: MatchProviderProps) => {
  const [watchedMatchId, setWatchedMatchId] = useState<string | null>(null);
  const [, forceUpdate] = useState({});

  const watchMatch = useCallback(
    (id: string | null) => {
      setWatchedMatchId(id);
      if (id) {
        onWatchMatch?.(id);
        const url = new URL(window.location.href);
        url.searchParams.set("matchId", id);
        window.history.replaceState({}, "", url.toString());
      } else {
        const url = new URL(window.location.href);
        url.searchParams.delete("matchId");
        window.history.replaceState({}, "", url.toString());
      }
    },
    [onWatchMatch]
  );

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("matchId");
    if (id?.trim()) {
      watchMatch(id.trim());
    }
  }, [watchMatch]);

  /** Re-renderizar listas (ex.: chips) quando o registry ganha/remove partidas fora de startMatch/removeMatch do contexto */
  useEffect(() => matchRegistry.subscribeStructural(() => forceUpdate({})), []);

  const cleanupRegistry = useCallback(() => {
    matchRegistry.removeEndedMatches();
    setWatchedMatchId((w) => {
      if (w && !matchRegistry.getMatch(w)) {
        const url = new URL(window.location.href);
        url.searchParams.delete("matchId");
        window.history.replaceState({}, "", url.toString());
        return null;
      }
      return w;
    });
    forceUpdate({});
  }, []);

  const value: MatchContextValue = {
    startMatch: useCallback((setup: MatchSetup) => {
      const id = matchRegistry.startMatch(setup);
      forceUpdate({});
      return id;
    }, []),
    listMatchIds: useCallback(() => matchRegistry.listMatchIds(), []),
    removeMatch: useCallback((id: string) => {
      matchRegistry.removeMatch(id);
      setWatchedMatchId((cur) => (cur === id ? null : cur));
      forceUpdate({});
    }, []),
    cleanupRegistry,
    watchedMatchId,
    watchMatch
  };

  return (
    <MatchContext.Provider value={value}>{children}</MatchContext.Provider>
  );
};

export const useMatchContext = () => useContext(MatchContext);

/** Hook para assinar uma partida por ID. Retorna estado e dispatcher. Atualiza quando a partida avança. */
export function useMatch(matchId: string | null) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!matchId) return () => {};
      return matchRegistry.subscribe(matchId, () => onStoreChange());
    },
    [matchId]
  );

  const getSnapshot = useCallback((): MatchState | null => {
    if (!matchId) return null;
    return matchRegistry.getMatch(matchId) ?? null;
  }, [matchId]);

  const getServerSnapshot = () => null;

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const dispatch = useCallback(
    (event: import("../types").MatchEvent) => {
      if (matchId) matchRegistry.dispatch(matchId, event);
    },
    [matchId]
  );

  return {
    state,
    start: () => dispatch({ type: "START" }),
    pause: () => dispatch({ type: "PAUSE" }),
    reset: () => dispatch({ type: "RESET" }),
    finishRound: () => dispatch({ type: "FINISH_ROUND" })
  };
}
