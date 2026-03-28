# CS Manager

Plataforma de fantasy/manager com simulação tática 2D de partidas (estilo Counter-Strike), apostas em moeda virtual e replay visual.

## Stack

| Camada   | Stack              | Porta |
|----------|--------------------|-------|
| Frontend | React 19 + Vite 8  | 5173  |
| Backend  | Express 5 + Prisma | 4000  |
| Banco    | PostgreSQL         | 5433  |

---

## Como rodar

### 1. Banco (Docker)

```bash
docker compose up -d
```

### 2. Backend

```bash
cd apps/server
npm install
cp .env.example .env   # Ajustar DATABASE_URL, JWT_SECRET
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

### 3. Frontend

```bash
cd apps/web
npm install
npm run dev
```

**Acesso:** http://localhost:5173

---

## Comandos úteis

| Comando         | Onde        |
|-----------------|-------------|
| `npm run dev`   | apps/web, apps/server |
| `npm run build` | apps/web    |
| `npm run test`  | apps/web    |
| `npm run db:studio` | apps/server |

---

## Controles do replay

- **Iniciar / Pausar** — simulação
- **Reiniciar** — nova partida (stats zeradas)

## Partidas ao vivo

Na aba **Partidas ao vivo**: partidas **ainda a decorrer** registadas no cliente aparecem numa lista ordenada pela **média de rating** dos dois times (API `ranking/global`). O bloco superior mostra placar, painéis RED/BLU e mapa; ao clicar numa linha, esse jogo passa a ser o exibido (sem saltar para a aba Simulação).

---

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Stack, estrutura, modelo de dados |
| [docs/ENGINE.md](docs/ENGINE.md) | Motor da simulação, combate, economia |
| [docs/MAPAS.md](docs/MAPAS.md) | Criação e uso de mapas |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Próximas fases |
| [docs/UI-CONVENCOES.md](docs/UI-CONVENCOES.md) | Padrões de UI, theme, tokens |
| [docs/OBSERVABILIDADE.md](docs/OBSERVABILIDADE.md) | Sentry, UptimeRobot |
