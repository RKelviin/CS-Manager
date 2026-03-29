/**
 * Registry global de partidas em execução.
 * Permite que partidas continuem em segundo plano quando o usuário navega para outras telas.
 * Cada partida tem um ID único para assistir de qualquer lugar.
 */
import {
  createMatchState,
  matchReducer,
  SIMULATION_TICK_MS
} from "../simulation";
import { DUST2_MAP } from "../map/dust2Map";
import type { MatchEvent, MatchSetup, MatchState } from "../types";

type Listener = (state: MatchState) => void;

const mapLabelFromSetup = (s: MatchSetup) => s.mapData?.name ?? DUST2_MAP.name;
const mapLabelFromState = (st: MatchState) => st.mapData?.name ?? DUST2_MAP.name;

/** Lobby ainda não iniciado (ou pausado no início) — candidato a deduplicação ao trocar mapa/setup. */
const isIdlePregameLobby = (st: MatchState): boolean =>
  st.round === 1 &&
  st.score.RED === 0 &&
  st.score.BLU === 0 &&
  !st.isRunning &&
  st.matchWinner == null &&
  !st.matchDraw;

const sameTeamsAndMap = (st: MatchState, setup: MatchSetup): boolean =>
  st.teamAName === setup.teamAName &&
  st.teamBName === setup.teamBName &&
  mapLabelFromState(st) === mapLabelFromSetup(setup);

class MatchRegistryImpl {
  private matches = new Map<string, MatchState>();
  private listeners = new Map<string, Set<Listener>>();
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  /** Versão incrementada em alterações estruturais (add/remove partida), não em cada tick. */
  private structuralVersion = 0;
  private structuralListeners = new Set<() => void>();

  subscribeStructural(cb: () => void): () => void {
    this.structuralListeners.add(cb);
    return () => this.structuralListeners.delete(cb);
  }

  getStructuralVersion(): number {
    return this.structuralVersion;
  }

  private notifyStructural(): void {
    this.structuralVersion += 1;
    this.structuralListeners.forEach((fn) => fn());
  }

  private ensureTickLoop() {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => this.tickAll(), SIMULATION_TICK_MS);
  }

  private stopTickLoopIfEmpty() {
    const hasRunning = [...this.matches.values()].some((s) => s.isRunning);
    if (!hasRunning && this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private tickAll() {
    for (const [id, state] of this.matches) {
      if (state.isRunning) {
        const next = matchReducer(state, { type: "TICK", deltaMs: SIMULATION_TICK_MS });
        this.matches.set(id, next);
        this.notify(id, next);
      }
    }
    this.stopTickLoopIfEmpty();
  }

  private notify(id: string, state: MatchState) {
    this.listeners.get(id)?.forEach((fn) => fn(state));
  }

  private removeMatchInternal(id: string): void {
    this.matches.delete(id);
    this.listeners.delete(id);
  }

  /** Inicia uma nova partida e retorna o ID. A partida começa pausada. */
  startMatch(setup: MatchSetup): string {
    const id = crypto.randomUUID();
    const state: MatchState = { ...createMatchState(setup), id };
    this.matches.set(id, state);
    this.ensureTickLoop();
    this.notifyStructural();
    return id;
  }

  /** Retorna o estado atual da partida ou null se não existir. */
  getMatch(id: string): MatchState | null {
    return this.matches.get(id) ?? null;
  }

  /** Lista IDs de todas as partidas ativas (em andamento ou finalizadas, ainda em memória). */
  listMatchIds(): string[] {
    return [...this.matches.keys()];
  }

  /**
   * Aplica mutação ao estado (ex.: reativar estratégia arquivada na StrategiesPage).
   * Não passa pelo reducer de tick. Publica sempre nova referência de estado e de coleções tocadas
   * para compatibilidade com useSyncExternalStore.
   */
  patchMatch(id: string, updater: (state: MatchState) => void): void {
    const prev = this.matches.get(id);
    if (!prev) return;
    const next: MatchState = {
      ...prev,
      customRedStrategies: prev.customRedStrategies.map((c) => ({
        ...c,
        stats: { ...c.stats }
      })),
      customBluStrategies: prev.customBluStrategies.map((c) => ({
        ...c,
        stats: { ...c.stats }
      })),
      strategyWeights: {
        RED: { ...prev.strategyWeights.RED },
        BLU: { ...prev.strategyWeights.BLU }
      }
    };
    updater(next);
    this.matches.set(id, next);
    this.notify(id, next);
  }

  /** Envia um evento para a partida. */
  dispatch(id: string, event: MatchEvent): void {
    const state = this.matches.get(id);
    if (!state) return;
    const next = matchReducer(state, event);
    this.matches.set(id, next);
    this.notify(id, next);
    if (event.type === "START") this.ensureTickLoop();
  }

  /** Inscreve-se para atualizações da partida. Retorna função para cancelar. */
  subscribe(id: string, listener: Listener): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(listener);
    const state = this.matches.get(id);
    if (state) listener(state);
    return () => {
      set?.delete(listener);
      if (set?.size === 0) this.listeners.delete(id);
    };
  }

  /** Remove uma partida do registry (libera memória). Partidas finalizadas podem ser removidas após visualização. */
  removeMatch(id: string): void {
    this.removeMatchInternal(id);
    this.notifyStructural();
    this.stopTickLoopIfEmpty();
  }

  /** Remove todas as partidas já decididas (vitória ou empate). Retorna quantas foram removidas. */
  removeEndedMatches(): number {
    const ids = [...this.matches.entries()]
      .filter(([, st]) => st.matchWinner != null || st.matchDraw)
      .map(([id]) => id);
    for (const id of ids) this.removeMatchInternal(id);
    if (ids.length > 0) this.notifyStructural();
    this.stopTickLoopIfEmpty();
    return ids.length;
  }

  /**
   * Remove outros lobbies idle (R1, 0–0, pausado) com os mesmos times e mapa que `setup`.
   * Mantém `keepId`. Usado ao recriar partida na Simulação (troca de mapa / realinhamento).
   */
  removeStaleIdleDuplicates(keepId: string, setup: MatchSetup): number {
    const ids: string[] = [];
    for (const [id, st] of this.matches) {
      if (id === keepId) continue;
      if (!sameTeamsAndMap(st, setup)) continue;
      if (!isIdlePregameLobby(st)) continue;
      ids.push(id);
    }
    for (const id of ids) this.removeMatchInternal(id);
    if (ids.length > 0) this.notifyStructural();
    this.stopTickLoopIfEmpty();
    return ids.length;
  }
}

export const matchRegistry = new MatchRegistryImpl();

/** Partidas do laboratório (Sandbox) — não aparecem na barra de partidas da liga. */
export const sandboxMatchRegistry = new MatchRegistryImpl();

/** Tipo de retorno ao iniciar uma partida */
export type StartMatchResult = { matchId: string };
