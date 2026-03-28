/** Barra de HP: verde (100%) → vermelho (0%) via matiz HSL */
export const HpBar = ({ hp, dead }: { hp: number; dead: boolean }) => {
  const pct = Math.max(0, Math.min(100, hp));
  const hue = dead ? 0 : (pct / 100) * 120;
  const saturation = dead ? 15 : 78;
  const light = dead ? 35 : 50;
  const fill = dead ? "#475569" : `hsl(${hue}, ${saturation}%, ${light}%)`;

  return (
    <div
      style={{ marginTop: 8 }}
      title={dead ? "Eliminado" : `HP ${hp}`}
      role="progressbar"
      aria-valuenow={dead ? 0 : hp}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          height: 9,
          borderRadius: 5,
          background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
          border: "1px solid #334155",
          overflow: "hidden",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.35)"
        }}
      >
        <div
          style={{
            width: dead ? "0%" : `${pct}%`,
            height: "100%",
            background: dead ? "transparent" : fill,
            boxShadow: dead ? undefined : "inset 0 1px 0 rgba(255,255,255,0.12)",
            transition: "width 0.2s ease, background 0.2s ease"
          }}
        />
      </div>
    </div>
  );
};
