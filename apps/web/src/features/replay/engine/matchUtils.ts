import type { MatchState } from "../types";

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const timeLabel = (ms: number) => {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** Log mais recente primeiro; limite curto para HUD */
export const pushLog = (state: MatchState, message: string) => {
  state.logs = [message, ...state.logs].slice(0, 10);
};
