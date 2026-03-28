# Convenções de UI e código visual

## Estrutura

```
apps/web/src/
  theme/           # Design tokens
    tokens.ts      # Paleta, espaçamento, tipografia
    index.ts
  index.css        # Variáveis CSS globais (--csm-*)
```

## Regras

1. **Use theme em vez de valores hardcoded**
   - `colors.text` em vez de `"#eef2ff"`
   - `spacing.lg` em vez de `16`
   - `radii.md` em vez de `8`

2. **Imports**
   ```tsx
   import { theme } from "../theme";
   const { colors, spacing } = theme;
   ```

3. **Cores semânticas**
   - `colors.text` — texto principal
   - `colors.textMuted` — labels, descrições
   - `colors.primary` — links, botões primários, item ativo
   - `colors.success` / `colors.error` — feedback

4. **Alterar paleta**: edite apenas `theme/tokens.ts` e `index.css`.

## Componentes migrados

- App.tsx
- Header
- Sidebar

Outros componentes devem migrar gradualmente.
