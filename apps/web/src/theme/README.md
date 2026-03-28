# Design System

Fonte única para cores, espaçamento e tipografia. Facilita alterações visuais em um só lugar.

## Uso

```tsx
import { theme } from "../theme";

// Destructuring opcional
const { colors, spacing, radii, typography } = theme;

style={{
  background: colors.bg,
  color: colors.text,
  padding: spacing.lg,
  borderRadius: radii.md
}}
```

## Tokens disponíveis

- **colors**: bg, bgElevated, bgInput, border, text, textMuted, primary, success, error, warning
- **spacing**: xs(4), sm(8), md(12), lg(16), xl(20), 2xl(24)
- **radii**: sm(6), md(8), lg(10), xl(12)
- **typography**: fontFamily, fontSize, fontWeight
- **zIndex**: header, overlay, sidebar

## Variáveis CSS

O `index.css` expõe `--csm-*` para uso em CSS ou `var(--csm-bg)` em style objects.

## Migração

Ao editar um componente, troque valores hardcoded por `theme.colors.*`, `theme.spacing.*`, etc.
