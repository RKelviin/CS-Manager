import { useEffect, useReducer } from "react";
import { createMatchState, matchReducer, SIMULATION_TICK_MS } from "../simulation";
import type { MatchSetup } from "../types";

export const useMatchSimulation = (setup?: MatchSetup) => {
  const [state, dispatch] = useReducer(matchReducer, setup, createMatchState);

  useEffect(() => {
    const id = setInterval(
      () => dispatch({ type: "TICK", deltaMs: SIMULATION_TICK_MS }),
      SIMULATION_TICK_MS
    );
    return () => clearInterval(id);
  }, []);

  return {
    state,
    start: () => dispatch({ type: "START" }),
    pause: () => dispatch({ type: "PAUSE" }),
    reset: () => dispatch({ type: "RESET" }),
    finishRound: () => dispatch({ type: "FINISH_ROUND" })
  };
};
