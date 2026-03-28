# CS Manager — Motor da simulação

## Visão geral

O replay 2D simula partidas em tempo real via **matchReducer** (`apps/web/src/features/replay/engine/`). Entrada estável para o app: **`simulation/index.ts`** (`SIMULATION_TICK_MS`, reducer, estado inicial). Loop por tick (~100ms): movimento, combate, plant/defuse, economia.

**Arquivos principais:**


| Arquivo               | Função                                     |
| --------------------- | ------------------------------------------ |
| `simulation/index.ts` | Contrato público do motor + tick ms        |
| `roundAdvance.ts`     | Próximo round, compras, halftime/OT, spawn |
| `matchReducer.ts`     | Loop TICK, combate, fim de round           |
| `situationalBrain.ts` | IA: movimento, targeting, objetivos TR/CT  |
| `ctStrategy.ts`       | Estratégias CT: 3-2, stack-a/b, aggressive |
| `roundBuy.ts`         | Compras, eco, AWPer, drop                  |
| `roleCombat.ts`       | Stats por arma, rotação da mira            |
| `combatConstants.ts`  | Dano, cadência, precisão                   |
| `economyConstants.ts` | Bônus round, loss streak, preços           |
| `bombConstants.ts`    | Tempos plant/defuse, raios C4/kit/**arma no chão** (`WEAPON_DROP_PICKUP_RADIUS`) |


---

## Drops de arma no chão

- Ao **morrer**, se a primária tiver tier **maior que zero** (não pistola), cria-se um item em `MatchState.weaponDrops` com posição (offset leve), nome da arma e **`angle`** do jogador (ícone no mapa alinhado à última mira).
- **Tier** (`weaponTierValue` em `ui/weaponIcons.tsx`, alinhado à economia): sniper 4, rifle 3, budget_rifle 2, smg 1, pistola 0.
- **Pickup:** qualquer jogador vivo pode recolher dentro do raio; só troca se o tier do chão for **maior** que o da primária atual; a arma antiga (se também for tier maior que zero) volta ao chão com offset.
- **Round novo:** `weaponDrops` é limpo em `roundAdvance` (como `defuseKitDrops`).
- **IA:** `situationalBrain` pode encaminhar bots para upgrades no chão (após prioridade da C4 largada para TR).
- **Canvas:** ícone com `drawMapHudWeaponIcon` em modo `iconAnchor: "world"` (sem círculo de fundo).

---

## Regulamento

- **Vitória:** primeiro a 7 rounds
- **Regulamento:** até 12 rounds (6 TR + 6 CT por time)
- **OT:** 6-6 → prorrogação (MR6). Primeiro a 13 vence; 15-15 empate
- **Meio-tempo:** round 7 — troca de lados, economia reiniciada, pistol

---

## Combate e armas

- **Hit chance:** base + aim/165 + bonus arma − penalidade distância − panic
- **Tipos:** sniper (AWP), rifle (AK/M4), budget_rifle (Galil/FAMAS), smg, pistol
- **Headshot:** chance por arma → dano × 4; capacete reduz (AWP penetra mais)
- **Peeker's advantage:** movimento em direção ao alvo → bônus hit chance

---

## Economia

- Pistol: $800
- Vitória: $3050 | Derrota: $2100–$3750 (streak)
- Kill/Plant/Defuse: $300
- Preços: AK $2700, M4 $3100, AWP $4750, Galil $1800, FAMAS $2050, SMG $1050–$1250

---

## Atributos dos jogadores


| Atributo      | Uso na partida                    |
| ------------- | --------------------------------- |
| **aim**       | Hit chance, precisão              |
| **reflex**    | Ordem de decisão, rotação da mira |
| **decision**  | Prioridade de alvo (C4, IGL)      |
| **composure** | Reduz penalty em HP baixo         |


---

## Estratégias e roles

**CT:** default (3-2), stack-a, stack-b, aggressive, hold, retake (pós-plant)

**TR:** rush, split, slow, default

**Roles:** IGL, Rifler, AWP, Entry, Sniper, Support, Lurker