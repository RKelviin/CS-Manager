import { useState, useEffect } from "react";
import { getPlayerTotal } from "../../shared/mvpMock";
import type { BotPlayer } from "./types";

const ROLES: BotPlayer["role"][] = ["Sniper", "Entry", "Support", "Lurker", "IGL"];

const COUNTRIES: { code: string; name: string }[] = [
  { code: "BR", name: "Brasil" },
  { code: "US", name: "Estados Unidos" },
  { code: "DK", name: "Dinamarca" },
  { code: "SE", name: "Suécia" },
  { code: "PL", name: "Polônia" },
  { code: "UA", name: "Ucrânia" },
  { code: "RU", name: "Rússia" },
  { code: "FR", name: "França" },
  { code: "DE", name: "Alemanha" },
  { code: "KR", name: "Coreia do Sul" },
  { code: "PT", name: "Portugal" },
  { code: "AU", name: "Austrália" },
  { code: "CA", name: "Canadá" },
  { code: "ES", name: "Espanha" },
  { code: "FI", name: "Finlândia" },
  { code: "NO", name: "Noruega" },
  { code: "TR", name: "Turquia" },
  { code: "CZ", name: "República Tcheca" },
  { code: "IL", name: "Israel" },
  { code: "", name: "—" }
];

const STATS = [
  { key: "aim" as const, label: "Precisão" },
  { key: "reflex" as const, label: "Reflexo" },
  { key: "decision" as const, label: "Inteligência" },
  { key: "composure" as const, label: "Composure" }
];

type Props = {
  player: BotPlayer;
  onSave: (updates: Partial<BotPlayer>) => void;
  onClose: () => void;
};

export const EditPlayerModal = ({ player, onSave, onClose }: Props) => {
  const [name, setName] = useState(player.name);
  const [role, setRole] = useState<BotPlayer["role"]>(player.role);
  const [nationality, setNationality] = useState(player.nationality ?? "");
  const [stats, setStats] = useState({
    aim: player.aim,
    reflex: player.reflex,
    decision: player.decision,
    composure: player.composure
  });

  useEffect(() => {
    setName(player.name);
    setRole(player.role);
    setNationality(player.nationality ?? "");
    setStats({
      aim: player.aim,
      reflex: player.reflex,
      decision: player.decision,
      composure: player.composure
    });
  }, [player]);

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const total = getPlayerTotal(stats);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim() || player.name,
      role,
      nationality: nationality || undefined,
      ...stats
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 101
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal
      aria-labelledby="edit-player-title"
    >
      <div
        style={{
          background: "linear-gradient(165deg, #111722 0%, #0c1018 100%)",
          border: "1px solid #2a3142",
          borderRadius: 16,
          padding: 24,
          width: "min(420px, 95vw)",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="edit-player-title" style={{ margin: "0 0 20px", fontSize: 18, color: "#e2e8f0" }}>
          Editar jogador
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#0c1018",
                border: "1px solid #2a3142",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 14
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Nacionalidade</label>
            <select
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#0c1018",
                border: "1px solid #2a3142",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 14
              }}
            >
              {COUNTRIES.map(({ code, name }) => (
                <option key={code || "empty"} value={code}>
                  {code
                    ? `${code
                        .split("")
                        .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
                        .join("")} ${name}`
                    : name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as BotPlayer["role"])}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#0c1018",
                border: "1px solid #2a3142",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 14
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                padding: "10px 14px",
                background: "rgba(47, 109, 246, 0.12)",
                borderRadius: 8,
                border: "1px solid rgba(47, 109, 246, 0.25)"
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 700, color: "#60a5fa", fontVariantNumeric: "tabular-nums" }}>{total}</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Total (média dos 4 atributos)</span>
            </div>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>Atributos</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {STATS.map(({ key, label }) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={stats[key]}
                    onChange={(e) => setStats((s) => ({ ...s, [key]: clamp(Number(e.target.value)) }))}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      background: "#0c1018",
                      border: "1px solid #2a3142",
                      borderRadius: 8,
                      color: "#e2e8f0",
                      fontSize: 13
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                background: "rgba(148, 163, 184, 0.1)",
                border: "1px solid #475569",
                borderRadius: 8,
                color: "#94a3b8",
                cursor: "pointer"
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                background: "rgba(47, 109, 246, 0.3)",
                border: "1px solid #2f6df6",
                borderRadius: 8,
                color: "#60a5fa",
                cursor: "pointer"
              }}
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
