# Observabilidade

## Stack

| Ferramenta | Uso |
|------------|-----|
| **Sentry** | Erros e performance (FE/BE) |
| **UptimeRobot** | Health check, alertas |

## Configuração

**Sentry:** `VITE_SENTRY_DSN` (web), `SENTRY_DSN` (server)

**UptimeRobot:** Monitor HTTP em `GET /health` (retorna `{ status: "ok" }`)

## Referências

- [Sentry React](https://docs.sentry.io/platforms/javascript/guides/react/)
- [UptimeRobot](https://uptimerobot.com)
