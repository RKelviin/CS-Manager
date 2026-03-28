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
- Mapas: Dust2, Inferno, editor, customizados via API

### Dashboard e Ranking
- Histórico de partidas
- Ranking por pontos (3 por vitória)
- Ranking de jogadores (K/D/A)

### Backend
- Auth, team, market, simulation, maps
- Betting e stream: rotas stub (retornam status)
- PostgreSQL, Prisma, migrations

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

### Fase 1 — Polish (curto prazo)
- Ajustes de UX
- Testes automatizados (Vitest)
- Monitoramento (Sentry, UptimeRobot)

### Fase 2 — Apostas
- Aposta pré-partida (quem ganha?)
- Valores: $100–$10.000
- Pool → rateio entre ganhadores
- Histórico de apostas

### Fase 3 — Ranking dinâmico
- Algoritmo: pontuação mais difícil de subir no topo
- Campeonatos recorrentes (agendamento, inscrições)
- Ligas públicas por faixa de pontuação

### Fase 4 — Centro de treinamento
- Tela "Centro de treinamento"
- Tipos de treino por atributo (aim, reflex, decision, composure)
- Custo: créditos + tempo real
- Melhorias compráveis para o centro (aumentam ganhos ou reduzem tempo)
- Ganhos variáveis por atributo e tipo

### Fase 5 — Pool booster-driven
- Booster gera jogadores reais (Player) no banco, vinculados ao time
- Mercado vende jogadores do pool (não apenas templates)
- Sistema de queima: usuário ou automático para jogadores ruins
- (Opcional) Limite de jogadores no time + taxa de manutenção

### Fase 6 — Social e competição
- Desafios diretos (partida amistosa entre dois times)
- Treinos entre times (simulação sem pontuação?)
- Compartilhar replay/histórico (link público)
- Ligas públicas (ranking como critério)

### Fase 7 — Monetização (pós-MVP)
- Recarga de créditos com dinheiro real
- Assinatura premium → benefícios no centro de treinamento
