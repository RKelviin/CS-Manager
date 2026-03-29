# Mapas

## Estrutura

- **width**, **height**: dimensões (ex.: 800×600)
- **walls**: retângulos `{ x, y, width, height }`
- **zones**: `site` (site-a, site-b), `spawn`
- **spawnPoints**: 5 posições `{ x, y }` por time (RED, BLU)
- **interestPoints** / **tacticalSpots** (opcional): campo `side` com `"RED"` (papel ataque), `"BLU"` (papel defesa) ou `"both"`, alinhado a `mapTypes.ts`.

## Editor

1. **Editor de mapas** no menu lateral
2. Ferramentas: Parede, Site A/B, Spawn zone, + Spawn RED/BLU (roster)
3. **Exportar para pasta**: envia ao servidor (POST `/api/maps`) — mapa aparece no seletor da simulação

## Mapas disponíveis

- **Built-in:** Dust2, Inferno, Mirage (`mapRegistry.ts`)
- **Customizados:** exportados via editor (`.map.json` em `map/`)

## Regras

- Sites: `site-a` e `site-b` obrigatórios
- Spawns: exatamente 5 pontos por time
