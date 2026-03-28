# Roadmap

Baseado na [Arquitetura](ARQUITETURA.md) do projeto.

---

## O que está construído

### Auth
- Signup, login, JWT
- Perfil (nome, email, saldo)
- Criação automática de time inicial com 5 jogadores ao cadastrar

### Team
- CRUD de times e jogadores
- 5 titulares + reservas ilimitadas
- Ordenação de reservas (pontuação, role, nome, nacionalidade)
- Troca titular/reserva, venda ao mercado
- Persistência: API (logado) ou localStorage (visitante)

### Market
- Catálogo de 100 PlayerTemplates (common, rare, epic, legendary)
- Filtros (role, nacionalidade, preço)
- Compra/venda integrada com wallet

### Booster Packs
- Compra de pacote (5 jogadores aleatórios)
- Integração com wallet e time

### Simulação e Liga
- Módulo `/api/simulation`: season, matches, ranking
- Liga: 4 times (1 usuário + 3 NPC), round-robin (6 partidas)
- Agendamento de partidas, execução no frontend, persistência no backend
- Premiações: $500 por vitória, $2000/$1000/$500 ao fim da temporada

### Replay
- Engine 2D: movimento, combate, plant/defuse, economia
- HUD: placar, bandeiras, armas, KDA, drop para companheiro
- **Drops de arma:** primária no chão à morte (exceto pistola), pickup por qualquer time com upgrade por tier, ícone no mapa com rotação da mira do morto
- **Partidas ao vivo:** lista de partidas em andamento no registry, ordenação por média de rating global; destaque automático do “melhor” confronto; vista espetador (placar + times + mapa)
- Regulamento: 7 rounds, OT (MR6), troca de lados no round 7
- Mapas: Dust2, Inferno, Mirage, editor, customizados via API

### Dashboard e Ranking
- Histórico de partidas
- Ranking por pontos (3 por vitória)
- Ranking de jogadores (K/D/A)

### Backend
- Auth, team, market, simulation, maps
- Betting e stream: rotas stub (retornam status)
- PostgreSQL, Prisma, migrations

---

## ⚠️ Pontos de Atenção Imediatos

### 🔴 Confiabilidade
- **Sentry ausente:** nenhum erro de runtime é capturado em produção (FE nem BE). Ver `docs/OBSERVABILIDADE.md`.
- **Sem validação de input (zod):** rotas de `auth`, `team` e `market` aceitam payloads arbitrários.
- **Erros não padronizados:** `shared/errors.ts` não cobre erros de negócio (saldo insuficiente, time cheio).
- **Sem rate limiting:** rotas de autenticação estão expostas a força bruta.

### 🟡 Performance
- **`getGlobalRanking` sem cache:** consulta full-scan a cada requisição; sem índice composto `(rating DESC, id)`.
- **Sem paginação por cursor:** ranking carrega todos os registros de uma vez.

### 🟠 Produto / UX
- **`UserPage` com valores hardcoded:** não usa o sistema de tokens de `theme/tokens.ts` (viola `docs/UI-CONVENCOES.md`).
- **Histórico de Elo sem rota exposta:** `rating.service.ts` já implementa o histórico, mas `ranking.routes.ts` não o expõe.
- **Boosters não persistem jogadores:** ao abrir um booster pack, nenhum `Player` real é criado no banco.

### 🔵 Módulos Stub
- **`/betting`** e **`/stream`** retornam apenas status; nenhuma lógica de negócio implementada.

---

## Decisões de produto

### 1. Apostas
- **Valor:** mínimo $100, máximo $10.000
- **Premiação:** rateio entre ganhadores
- **Tipo:** aposta simples pré-partida (quem ganha?)

### 2. Ranking dinâmico
- Pontuação dinâmica: quanto mais alto no ranking, mais difícil subir
- Campeonatos recorrentes para times jogarem e pontuarem
- Ligas públicas baseadas na pontuação do time

### 3–4. Centro de treinamento
- Custo: **créditos + tempo real**
- Comprar melhorias para o centro
- Colocar jogadores para treinar
- Ganhos variáveis por atributo e por tipo de treinamento

### 5. Pool de jogadores (Booster-driven)
- Pool baseada em abertura de booster packs
- Ao abrir: jogador cadastrado no banco, vinculado ao time do usuário, pode ir ao mercado
- Sistema de "queima" de jogadores ruins (limpeza automática ou ação do usuário)

### 6. Social e competição
- Ligas públicas por pontuação
- Desafios diretos (amistosos)
- Treinos entre times
- Compartilhar histórico e replay

### 7. Monetização
- **Futuro:** recarga com dinheiro real, assinatura premium (melhoria do centro de treinamento)
- **MVP:** apenas moeda virtual

---

## Fases planejadas

### Fase 0 — Documentação e Arquitetura
- Manter `ROADMAP.md`, `ARQUITETURA.md`, `ENGINE.md`, `MAPAS.md`, `OBSERVABILIDADE.md` e `UI-CONVENCOES.md` sempre atualizados a cada fase concluída.
- Registrar decisões de produto e ADRs no diretório `docs/`.

---

### Fase 1 — Confiabilidade: Observabilidade, Tratamento de Erros e Validação de Input

> ⚠️ Endereça: 🔴 Sentry ausente · 🔴 Sem zod · 🔴 Erros não padronizados · 🔴 Sem rate limiting

- Integrar Sentry no frontend (`main.tsx`, `ErrorBoundary.tsx`) e no backend (`server.ts`) conforme `docs/OBSERVABILIDADE.md`
- Adicionar validação com `zod` nas rotas de `auth`, `team` e `market`, retornando erros 400 estruturados
- Expandir `shared/errors.ts` com erros de negócio (saldo insuficiente, time cheio)
- Adicionar rate limiting em `app.ts` para rotas de autenticação

---

### Fase 2 — Polish de UI: Migração de Tokens e Perfil de Usuário Completo

> ⚠️ Endereça: 🟠 UserPage hardcoded · 🟠 Histórico Elo sem rota

- Migrar `UserPage.tsx` dos valores hardcoded para o sistema de tokens de `theme/tokens.ts` seguindo `docs/UI-CONVENCOES.md`
- Expor `GET /ranking/teams/:teamId/history` em `ranking.routes.ts` (já implementado no `rating.service.ts`)
- Expandir `UserPage` com histórico de rating Elo, estatísticas de temporada (V/D, K/D/A) e atalho para editar nome do time

---

### Fase 3 — Sistema de Apostas (Betting)

> ⚠️ Endereça: 🔵 Módulo stub `/betting`

- Criar modelo `Bet` no schema Prisma: `userId`, `matchId`, `teamId`, `amount`, `status` (pending/won/lost), `payout`
- Implementar `betting.service.ts`: `placeBet` (valida $100–$10.000, debita wallet) e `settleBets` (rateio, chamado em `persistMatchResult`)
- Substituir stub em `betting.routes.ts` com rotas reais: `POST /betting/bets`, `GET /betting/bets`, `GET /betting/matches/:matchId/odds`
- Criar `BettingPanel` integrado à `SimulationPage`

---

### Fase 4 — Engine: Evolução da Jogabilidade (Novos Mapas e Estratégias) ✅ concluída
- Adicionar 1 novo mapa built-in (ex: Nuke ou Ancient) seguindo o padrão de `inferno.ts` / `inferno.map.json`, registrando em `mapRegistry.ts`
- Implementar estratégia TR `fake` em `trStrategy.ts` e CT `rotate` em `ctStrategy.ts`
- Adicionar atributo `morale` (0–100) em `createMatchState.ts`: afeta `composure` após loss streak ≥ 3
- Expor `morale` no `TeamPanel.tsx`

---

### Fase 5 — Centro de Treinamento
- Adicionar modelos `TrainingSlot` e `TrainingUpgrade` ao schema Prisma
- Criar módulo `training` com rotas: `POST /training/start`, `POST /training/collect`, `GET /training/status`
- Lógica: custo em créditos, ganho de atributo (+1 a +3) após `finishesAt`; upgrades reduzem tempo ou aumentam ganho
- Criar `TrainingPage.tsx` com seleção de jogador, tipo de treino, timer e botão de coleta

---

### Fase 6 — Pool Booster-Driven e Mercado de Jogadores Reais

> ⚠️ Endereça: 🟠 Boosters sem persistência

- Ao abrir booster: criar `Player` real no banco vinculado ao time do usuário
- Adicionar modelo `MarketListing` ao Prisma: `playerId`, `sellerId`, `price`, `status`
- Rotas P2P: `POST /market/listings`, `POST /market/listings/:id/buy`
- Sistema de queima: `POST /team/players/:id/release` (devolve % do valor)
- Atualizar `MarketPage` para exibir jogadores reais além dos templates

---

### Fase 7 — Social: Desafios Diretos e Compartilhamento de Replay
- `POST /simulation/challenge`: cria `Match` com `matchType: 'friendly'` (sem impacto no Elo)
- `GET /simulation/matches/:id/replay-token`: JWT público de curta duração
- Rota pública `/replay/:token` no frontend carregando `LiveSpectatorLayout` sem sidebar/header
- Lista de desafios pendentes no `DashboardPage`

---

### Fase 8 — Escalabilidade: Performance e Ranking Dinâmico

> ⚠️ Endereça: 🟡 getGlobalRanking sem cache · 🟡 Sem índice composto

- Cursor-based pagination em `getGlobalRanking` + índice composto `(rating DESC, id)` via migration Prisma
- Cache em memória (TTL 30s) para `getGlobalRanking` e `getRankingPreview`
- `GET /ranking/leagues`: grupos Bronze/Prata/Ouro/Platina/Diamante/Lendário por faixa de rating
- Job recorrente em `server.ts` (`setInterval`) para criação automática de nova Season

---

### Fase 9 — Monetização (pós-MVP)
- Recarga de créditos com dinheiro real
- Assinatura premium → benefícios no centro de treinamento (ganhos maiores, tempo reduzido)
- **MVP:** apenas moeda virtual (sem alteração)
