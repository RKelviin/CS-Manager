# CS Manager — Arquitetura

## Visão geral

Monólito modular: **React + Vite** (frontend) e **Express + Prisma** (backend) com PostgreSQL.

| Camada     | Stack            | Porta  |
|------------|------------------|--------|
| Frontend   | React 19, Vite 8 | 5173   |
| Backend    | Express 5, Prisma| 4000   |
| Banco      | PostgreSQL       | 5433   |

**Fluxo:** Frontend usa `apiClient` → `/api/*` (proxy no Vite para `localhost:4000`).

---

## Estrutura do projeto

```
apps/
  web/           # SPA: Replay, Team, Market, Auth
    src/features/   auth, team, market, replay
    src/pages/      Rotas
    src/shared/     apiClient, utils
  server/        # API REST
    src/db/         Prisma, schema, seed, migrations
    src/modules/    auth, team, market, simulation, maps (betting, stream = stub)
docs/
  ARQUITETURA.md   Este arquivo
  ENGINE.md        Motor da simulação
  MAPAS.md         Criação e uso de mapas
  ROADMAP.md       Próximas fases
  OBSERVABILIDADE.md  Sentry, UptimeRobot
```

### Feature `replay` (simulação no cliente)

- **`features/replay/index.ts`** — API pública para páginas: `MatchProvider`, `useMatchContext`, `useMatch`, `matchRegistry`, **`sandboxMatchRegistry`**, `createSandboxBot`, tipos (incl. overrides sandbox), domínio de times.
- **`simulation/`** — contrato do motor: `matchReducer`, `createMatchState`, `SIMULATION_TICK_MS`, avanço de round (`roundAdvance`).
- **`domain/teamModel.ts`** — documentação e helpers **RED/BLU (roster)** vs **papel RED (ataque) / BLU (defesa) por round**.
- **`engine/`** — implementação (reducer principal, combate, economia, IA, drops de arma); **`matchConstants.ts`** concentra regulamento, troca de papéis por round e **paletas HUD/mapa** (`getTeamDisplayColor`). Ver `docs/ENGINE.md` (secção HUD e cores).
- **`state/`** — `matchRegistry` (partidas em background, tick global): `removeEndedMatches`, `removeStaleIdleDuplicates` (evita acumular lobbies 0–0 R1 ao trocar mapa), `subscribeStructural` para listas; `MatchContext` com `cleanupRegistry` e `watchMatch` (URL `?matchId=`, pode mudar para Simulação). **`sandboxMatchRegistry`** — instância separada usada só pela página Sandbox.
- **`ui/`** — componentes da partida (`MatchHUD`, `GameCanvas`, `TeamPanel`, …) e **`LiveSpectatorLayout`** (HUD + times + mapa, sem controlos/log); barrel `ui/index.ts`.
- **`utils/matchRankingLookup.ts`** — cruza nomes de times com o ranking global (`/api/ranking/global`) para ordenação e destaque na página **Partidas ao vivo**.

### Páginas relevantes ao replay

| Página            | Função |
|-------------------|--------|
| **Simulação**     | Criar/assistir partida com controlos, log, overlay de fim; várias partidas em paralelo no registry. |
| **Sandbox**       | Laboratório do motor (`PlaytestLabPage`): `sandboxMatchRegistry`, `STEP` com pausa, overrides de combate (0–200%), loadout global, spawn por clique, overlay nav/path. Ver `docs/ENGINE.md` (secção Sandbox). |
| **Partidas ao vivo** | Lista partidas **em andamento** no registry; destaque automático pela **média de rating** dos dois times; clique na lista troca o jogo exibido (só espetáculo: placar, painéis, mapa). Não altera `watchMatch` / aba Simulação. |

---

## Modelo de dados

```
User ──┬─ walletBalance
       └─ Team ── Player (aim, reflex, decision, composure, role, isStarter)
PlayerTemplate (catálogo do mercado, 100 jogadores)
```

---

## Módulos da API

| Rota            | Função                         |
|-----------------|--------------------------------|
| `/auth`         | signup, login, me              |
| `/team`         | CRUD times, jogadores, sell    |
| `/market`       | listings, purchase, booster    |
| `/simulation`   | season, matches, ranking, run  |
| `/maps`         | listar, criar mapas            |
| `/health`       | Health check                   |
| `/betting`      | stub                           |
| `/stream`       | stub                           |

---

## Modos de acesso

| Tipo     | Team        | Market   | Replay   |
|----------|-------------|----------|----------|
| Visitante| localStorage| Visualizar | Assistir |
| Logado   | API         | Comprar/vender | Assistir |
