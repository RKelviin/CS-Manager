import { useState, useRef, useCallback, useEffect } from "react";
import type {
  MapData,
  MapInterestPoint,
  MapInterestPointSide,
  MapInterestPointType,
  MapTacticalSpot
} from "../features/replay/map/mapTypes";
import { EMPTY_MAP } from "../features/replay/map/mapTypes";
import { DUST2_MAP } from "../features/replay/map/dust2Map";
import { saveMapToFolder } from "../features/replay/map/mapRegistry";

const GRID = 10;
const SNAP = (v: number) => Math.round(v / GRID) * GRID;

type Tool =
  | "select"
  | "wall"
  | "zone-site"
  | "zone-spawn"
  | "spawn-red"
  | "spawn-blu"
  | "interest-point"
  | "tactical-spot";

type EditorSelection =
  | { type: "wall"; index: number }
  | { type: "zone"; index: number }
  | { type: "spawn"; index: number; team: "RED" | "BLU" }
  | { type: "interest"; index: number }
  | { type: "tactical"; index: number }
  | null;

const interestIcon = (t: MapInterestPointType) =>
  t === "angle" ? "⭐" : t === "flank" ? "⚡" : t === "choke" ? "◆" : "🎯";

const dust2ToMapData = (): MapData => ({
  name: DUST2_MAP.name,
  width: DUST2_MAP.width,
  height: DUST2_MAP.height,
  walls: DUST2_MAP.walls.map((w) => ({ ...w })),
  zones: DUST2_MAP.zones.map((z) => ({ ...z })),
  spawnPoints: {
    RED: DUST2_MAP.spawnPoints.RED.map((p) => ({ ...p })),
    BLU: DUST2_MAP.spawnPoints.BLU.map((p) => ({ ...p }))
  },
  interestPoints: (DUST2_MAP.interestPoints ?? []).map((p) => ({ ...p })),
  tacticalSpots: (DUST2_MAP.tacticalSpots ?? []).map((p) => ({ ...p }))
});

export const MapEditorPage = () => {
  const [map, setMap] = useState<MapData>(() => dust2ToMapData());
  const [tool, setTool] = useState<Tool>("select");
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<EditorSelection>(null);
  const [interestModal, setInterestModal] = useState<{
    x: number;
    y: number;
    type: MapInterestPointType;
    side: MapInterestPointSide;
    aimDeg: string;
  } | null>(null);
  const [tacticalModal, setTacticalModal] = useState<{
    x: number;
    y: number;
    label: string;
    watchDeg: string;
    side: "TR" | "CT" | "both";
  } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current;
      if (!c) return { x: 0, y: 0 };
      const rect = c.getBoundingClientRect();
      const scaleX = map.width / rect.width;
      const scaleY = map.height / rect.height;
      return {
        x: SNAP((e.clientX - rect.left) * scaleX),
        y: SNAP((e.clientY - rect.top) * scaleY)
      };
    },
    [map.width, map.height]
  );

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { width, height } = map;

    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#22262e";
    ctx.fillRect(10, 10, width - 20, height - 20);

    for (let x = 0; x <= width; x += GRID) {
      ctx.strokeStyle = "rgba(60,70,90,0.4)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += GRID) {
      ctx.strokeStyle = "rgba(60,70,90,0.4)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    map.walls.forEach((wall, i) => {
      const sel = selected?.type === "wall" && selected.index === i;
      ctx.fillStyle = sel ? "#5a6a8a" : "#3d4656";
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      ctx.strokeStyle = sel ? "#7f9ef3" : "#4a5568";
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
    });

    map.zones.forEach((z, i) => {
      const sel = selected?.type === "zone" && selected.index === i;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = z.type === "site" ? (sel ? "#f87171" : "#ef4444") : sel ? "#60a5fa" : "#3b82f6";
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(z.x, z.y, z.width, z.height);
      ctx.setLineDash([]);
      ctx.fillStyle = z.type === "site" ? "rgba(239,68,68,0.08)" : "rgba(59,130,246,0.08)";
      ctx.fillRect(z.x, z.y, z.width, z.height);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(z.name, z.x + 4, z.y + 14);
    });

    map.spawnPoints.RED.forEach((p, i) => {
      const sel = selected?.type === "spawn" && selected.team === "RED" && selected.index === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = sel ? "#f87171" : "rgba(239,68,68,0.5)";
      ctx.fill();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = sel ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "9px Inter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`R${i + 1}`, p.x, p.y);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    });
    map.spawnPoints.BLU.forEach((p, i) => {
      const sel = selected?.type === "spawn" && selected.team === "BLU" && selected.index === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = sel ? "#60a5fa" : "rgba(59,130,246,0.5)";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = sel ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "9px Inter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`B${i + 1}`, p.x, p.y);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    });

    (map.interestPoints ?? []).forEach((p, i) => {
      const sel = selected?.type === "interest" && selected.index === i;
      ctx.font = sel ? "18px sans-serif" : "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(interestIcon(p.type), p.x, p.y);
      if (sel) {
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    (map.tacticalSpots ?? []).forEach((s, i) => {
      const sel = selected?.type === "tactical" && selected.index === i;
      ctx.beginPath();
      ctx.arc(s.x, s.y, sel ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = sel ? "rgba(34,197,94,0.85)" : "rgba(34,197,94,0.45)";
      ctx.fill();
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = sel ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "10px Inter, sans-serif";
      ctx.fillText(s.label, s.x + 10, s.y - 8);
    });

    if (dragStart && dragEnd) {
      const x = Math.min(dragStart.x, dragEnd.x);
      const y = Math.min(dragStart.y, dragEnd.y);
      const w = Math.abs(dragEnd.x - dragStart.x);
      const h = Math.abs(dragEnd.y - dragStart.y);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = tool === "zone-site" ? "#ef4444" : tool === "zone-spawn" ? "#3b82f6" : "#64748b";
      ctx.strokeRect(x, y, w || GRID, h || GRID);
      ctx.setLineDash([]);
    }
  }, [map, selected, dragStart, dragEnd, tool]);

  useEffect(() => draw(), [draw]);

  const hitTest = useCallback(
    (cx: number, cy: number) => {
      const ts = map.tacticalSpots ?? [];
      for (let i = ts.length - 1; i >= 0; i--) {
        const s = ts[i]!;
        if (Math.hypot(cx - s.x, cy - s.y) <= 11) return { type: "tactical" as const, index: i };
      }
      const ip = map.interestPoints ?? [];
      for (let i = ip.length - 1; i >= 0; i--) {
        const p = ip[i]!;
        if (Math.hypot(cx - p.x, cy - p.y) <= 18) return { type: "interest" as const, index: i };
      }
      for (let i = map.walls.length - 1; i >= 0; i--) {
        const w = map.walls[i];
        if (cx >= w.x && cx <= w.x + w.width && cy >= w.y && cy <= w.y + w.height)
          return { type: "wall" as const, index: i };
      }
      for (let i = map.zones.length - 1; i >= 0; i--) {
        const z = map.zones[i];
        if (cx >= z.x && cx <= z.x + z.width && cy >= z.y && cy <= z.y + z.height)
          return { type: "zone" as const, index: i };
      }
      for (let i = map.spawnPoints.RED.length - 1; i >= 0; i--) {
        const p = map.spawnPoints.RED[i];
        if (Math.hypot(cx - p.x, cy - p.y) <= 12) return { type: "spawn" as const, index: i, team: "RED" as const };
      }
      for (let i = map.spawnPoints.BLU.length - 1; i >= 0; i--) {
        const p = map.spawnPoints.BLU[i];
        if (Math.hypot(cx - p.x, cy - p.y) <= 12) return { type: "spawn" as const, index: i, team: "BLU" as const };
      }
      return null;
    },
    [map]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    if (tool === "select") {
      const hit = hitTest(x, y);
      setSelected(hit ? { ...hit } : null);
      return;
    }
    if (tool === "spawn-red" || tool === "spawn-blu") {
      const team = tool === "spawn-red" ? "RED" : "BLU";
      const arr = [...map.spawnPoints[team]];
      if (arr.length >= 5) return;
      arr.push({ x, y });
      setMap((m) => ({
        ...m,
        spawnPoints: { ...m.spawnPoints, [team]: arr }
      }));
      return;
    }
    if (tool === "interest-point") {
      setInterestModal({ x, y, type: "angle", side: "CT", aimDeg: "" });
      return;
    }
    if (tool === "tactical-spot") {
      setTacticalModal({ x, y, label: "spot", watchDeg: "-90", side: "both" });
      return;
    }
    if (tool === "wall" || tool === "zone-site" || tool === "zone-spawn") {
      setDragStart({ x, y });
      setDragEnd({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragStart) setDragEnd(getCanvasCoords(e));
  };

  const handleMouseUp = () => {
    if (!dragStart || !dragEnd) return;
    const x = Math.min(dragStart.x, dragEnd.x);
    const y = Math.min(dragStart.y, dragEnd.y);
    const width = Math.max(GRID, Math.abs(dragEnd.x - dragStart.x));
    const height = Math.max(GRID, Math.abs(dragEnd.y - dragStart.y));
    if (tool === "wall") {
      setMap((m) => ({ ...m, walls: [...m.walls, { x, y, width, height }] }));
    } else if (tool === "zone-site") {
      const id = `site-${String.fromCharCode(97 + map.zones.filter((z) => z.type === "site").length)}`;
      setMap((m) => ({
        ...m,
        zones: [...m.zones, { id, name: id.toUpperCase(), x, y, width, height, type: "site" }]
      }));
    } else if (tool === "zone-spawn") {
      const id = `spawn-${map.zones.filter((z) => z.type === "spawn").length ? "ct" : "t"}`;
      setMap((m) => ({
        ...m,
        zones: [...m.zones, { id, name: id === "spawn-t" ? "T Spawn" : "CT Spawn", x, y, width, height, type: "spawn" }]
      }));
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.type === "wall") {
      setMap((m) => ({ ...m, walls: m.walls.filter((_, i) => i !== selected.index) }));
    } else if (selected.type === "zone") {
      setMap((m) => ({ ...m, zones: m.zones.filter((_, i) => i !== selected.index) }));
    } else if (selected.type === "spawn" && selected.team) {
      setMap((m) => ({
        ...m,
        spawnPoints: {
          ...m.spawnPoints,
          [selected.team!]: m.spawnPoints[selected.team!].filter((_, i) => i !== selected.index)
        }
      }));
    } else if (selected.type === "interest") {
      setMap((m) => ({
        ...m,
        interestPoints: (m.interestPoints ?? []).filter((_, i) => i !== selected.index)
      }));
    } else if (selected.type === "tactical") {
      setMap((m) => ({
        ...m,
        tacticalSpots: (m.tacticalSpots ?? []).filter((_, i) => i !== selected.index)
      }));
    }
    setSelected(null);
  };

  const loadFromFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result as string) as MapData;
          if (data.walls && data.zones && data.spawnPoints) setMap(data);
        } catch {}
      };
      r.readAsText(f);
    };
    input.click();
  };

  const saveAsJson = () => {
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${map.name.replace(/\s/g, "-").toLowerCase()}.map.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportAsTs = () => {
    const lines = [
      `export const MAP_DATA = ${JSON.stringify(map, null, 2)} as const;`,
      "",
      "// Para usar no engine, importe e passe MAP_DATA para as funções que aceitam MapData."
    ].join("\n");
    const blob = new Blob([lines], { type: "text/typescript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${map.name.replace(/\s/g, "-").toLowerCase()}.ts`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const resetToDust2 = () => setMap(dust2ToMapData());
  const newMap = () => setMap({ ...EMPTY_MAP, width: map.width, height: map.height });

  const exportToFolder = async () => {
    if (map.spawnPoints.RED.length < 5 || map.spawnPoints.BLU.length < 5) {
      setExportStatus("Adicione 5 spawns TR e 5 spawns CT.");
      return;
    }
    const sites = map.zones.filter((z) => z.type === "site");
    if (!sites.some((z) => z.id === "site-a") || !sites.some((z) => z.id === "site-b")) {
      setExportStatus("Adicione zonas site-a e site-b.");
      return;
    }
    const ipc = map.interestPoints?.length ?? 0;
    const tsc = map.tacticalSpots?.length ?? 0;
    if (ipc < 3 || tsc < 2) {
      const msg = `Aviso: poucos dados táticos (pontos de interesse: ${ipc}, spots: ${tsc}). Recomenda-se ≥3 interesse e ≥2 spots para um mapa bem definido. Exportar mesmo assim?`;
      if (!window.confirm(msg)) {
        setExportStatus("Exportação cancelada — adicione mais pontos táticos ou confirme na próxima vez.");
        return;
      }
    }
    setExportStatus(null);
    try {
      const { id, name } = await saveMapToFolder(map);
      setExportStatus(`Salvo em apps/web/src/features/replay/map/ como ${id}.map.json e ${id}.ts`);
    } catch (e) {
      setExportStatus(e instanceof Error ? e.message : "Erro ao exportar");
    }
  };

  const tools: { key: Tool; label: string }[] = [
    { key: "select", label: "Selecionar" },
    { key: "wall", label: "Parede" },
    { key: "zone-site", label: "Site (A/B)" },
    { key: "zone-spawn", label: "Spawn zone" },
    { key: "spawn-red", label: "+ Spawn TR" },
    { key: "spawn-blu", label: "+ Spawn CT" },
    { key: "interest-point", label: "Ponto de interesse" },
    { key: "tactical-spot", label: "Spot tático" }
  ];

  const patchInterest = (index: number, patch: Partial<MapInterestPoint>) => {
    setMap((m) => {
      const list = [...(m.interestPoints ?? [])];
      const cur = list[index];
      if (!cur) return m;
      list[index] = { ...cur, ...patch };
      return { ...m, interestPoints: list };
    });
  };

  const patchTactical = (index: number, patch: Partial<MapTacticalSpot>) => {
    setMap((m) => {
      const list = [...(m.tacticalSpots ?? [])];
      const cur = list[index];
      if (!cur) return m;
      list[index] = { ...cur, ...patch };
      return { ...m, tacticalSpots: list };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Editor de mapas</h1>
      <p style={{ color: "#94a3b8", fontSize: 14 }}>
        Desenhe paredes (retângulos), zonas de site/spawn e pontos de spawn. Exporte como JSON ou TypeScript.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {tools.map((t) => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            style={{
              padding: "8px 14px",
              background: tool === t.key ? "#2f6df6" : "#1e293b",
              color: "#fff",
              border: "1px solid #334155",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13
            }}
          >
            {t.label}
          </button>
        ))}
        <span style={{ marginLeft: 8, color: "#64748b", fontSize: 13 }}>
          {tool === "spawn-red" && `Spawns TR: ${map.spawnPoints.RED.length}/5`}
          {tool === "spawn-blu" && `Spawns CT: ${map.spawnPoints.BLU.length}/5`}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={deleteSelected}
          disabled={!selected}
          style={{
            padding: "8px 14px",
            background: selected ? "#dc2626" : "#334155",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: selected ? "pointer" : "not-allowed",
            fontSize: 13
          }}
        >
          Excluir selecionado
        </button>
        <button onClick={loadFromFile} style={btnStyle}>
          Carregar JSON
        </button>
        <button onClick={saveAsJson} style={btnStyle}>
          Salvar JSON
        </button>
        <button onClick={exportAsTs} style={btnStyle}>
          Exportar .ts
        </button>
        <button onClick={exportToFolder} style={btnStyle}>
          Exportar para pasta
        </button>
        {exportStatus && (
          <span style={{ color: exportStatus.startsWith("Salvo") ? "#22c55e" : "#f87171", fontSize: 13 }}>
            {exportStatus}
          </span>
        )}
        <button onClick={resetToDust2} style={btnStyle}>
          Resetar (Dust2)
        </button>
        <button onClick={newMap} style={btnStyle}>
          Novo mapa vazio
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 12, color: "#94a3b8", marginRight: 8 }}>Largura</label>
          <input
            type="number"
            value={map.width}
            onChange={(e) => setMap((m) => ({ ...m, width: Math.max(400, parseInt(e.target.value) || 800) }))}
            style={{ width: 70, padding: 6, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#fff" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#94a3b8", marginRight: 8 }}>Altura</label>
          <input
            type="number"
            value={map.height}
            onChange={(e) => setMap((m) => ({ ...m, height: Math.max(300, parseInt(e.target.value) || 600) }))}
            style={{ width: 70, padding: 6, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#fff" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#94a3b8", marginRight: 8 }}>Nome</label>
          <input
            type="text"
            value={map.name}
            onChange={(e) => setMap((m) => ({ ...m, name: e.target.value }))}
            style={{ width: 180, padding: 6, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#fff" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        <canvas
          ref={canvasRef}
          width={map.width}
          height={map.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            border: "2px solid #334155",
            borderRadius: 8,
            maxWidth: "100%",
            cursor: tool === "select" ? "default" : "crosshair"
          }}
        />
        <div style={{ minWidth: 280, maxWidth: 360, fontSize: 12 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Resumo</h3>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Paredes: {map.walls.length}</p>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Zonas: {map.zones.length}</p>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Spawns TR: {map.spawnPoints.RED.length}/5</p>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Spawns CT: {map.spawnPoints.BLU.length}/5</p>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>
            Interesse: {(map.interestPoints ?? []).length} · Spots: {(map.tacticalSpots ?? []).length}
          </p>

          <h4 style={{ fontSize: 13, margin: "16px 0 8px" }}>Pontos de interesse</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 200, overflowY: "auto" }}>
            {(map.interestPoints ?? []).map((p, i) => (
              <li
                key={p.id}
                style={{
                  padding: 8,
                  marginBottom: 6,
                  background: selected?.type === "interest" && selected.index === i ? "#2a3142" : "#1e293b",
                  borderRadius: 6,
                  border: "1px solid #334155"
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelected({ type: "interest", index: i })}
                  style={{ background: "none", border: "none", color: "#e2e8f0", cursor: "pointer", padding: 0 }}
                >
                  {interestIcon(p.type)} {p.id.slice(0, 12)}… ({p.x},{p.y})
                </button>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  <select
                    value={p.type}
                    onChange={(e) => patchInterest(i, { type: e.target.value as MapInterestPointType })}
                    style={inpCompact}
                  >
                    <option value="angle">angle</option>
                    <option value="flank">flank</option>
                    <option value="choke">choke</option>
                    <option value="cover">cover</option>
                  </select>
                  <select
                    value={p.side}
                    onChange={(e) => patchInterest(i, { side: e.target.value as MapInterestPointSide })}
                    style={inpCompact}
                  >
                    <option value="TR">TR</option>
                    <option value="CT">CT</option>
                    <option value="both">both</option>
                  </select>
                  <input
                    type="text"
                    placeholder="aim graus (opcional)"
                    value={
                      p.aimAngle != null ? String(Math.round((p.aimAngle * 180) / Math.PI)) : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      patchInterest(i, {
                        aimAngle: v === "" ? undefined : (parseFloat(v) * Math.PI) / 180
                      });
                    }}
                    style={inpCompact}
                  />
                </div>
              </li>
            ))}
          </ul>

          <h4 style={{ fontSize: 13, margin: "16px 0 8px" }}>Spots táticos</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 200, overflowY: "auto" }}>
            {(map.tacticalSpots ?? []).map((s, i) => (
              <li
                key={`${s.label}-${i}`}
                style={{
                  padding: 8,
                  marginBottom: 6,
                  background: selected?.type === "tactical" && selected.index === i ? "#2a3142" : "#1e293b",
                  borderRadius: 6,
                  border: "1px solid #334155"
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelected({ type: "tactical", index: i })}
                  style={{ background: "none", border: "none", color: "#86efac", cursor: "pointer", padding: 0 }}
                >
                  {s.label}
                </button>
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => patchTactical(i, { label: e.target.value })}
                  style={{ ...inpCompact, marginTop: 6 }}
                />
                <input
                  type="text"
                  placeholder="watch graus"
                  value={String(Math.round((s.watchAngle * 180) / Math.PI))}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (!Number.isFinite(n)) return;
                    patchTactical(i, { watchAngle: (n * Math.PI) / 180 });
                  }}
                  style={{ ...inpCompact, marginTop: 4 }}
                />
                <select
                  value={s.side ?? "both"}
                  onChange={(e) =>
                    patchTactical(i, { side: e.target.value as "TR" | "CT" | "both" })
                  }
                  style={{ ...inpCompact, marginTop: 4 }}
                >
                  <option value="TR">TR</option>
                  <option value="CT">CT</option>
                  <option value="both">both</option>
                </select>
              </li>
            ))}
          </ul>

          <p style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
            Para usar o mapa na simulação, exporte como .ts e adicione em <code>apps/web/src/features/replay/map/</code>. Veja docs/MAPAS.md.
          </p>
        </div>
      </div>

      {interestModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>Novo ponto de interesse</h3>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              Posição: {interestModal.x}, {interestModal.y}
            </p>
            <label style={lbl}>Tipo</label>
            <select
              value={interestModal.type}
              onChange={(e) =>
                setInterestModal((m) => (m ? { ...m, type: e.target.value as MapInterestPointType } : m))
              }
              style={inpCompact}
            >
              <option value="angle">angle ⭐</option>
              <option value="flank">flank ⚡</option>
              <option value="choke">choke ◆</option>
              <option value="cover">cover 🎯</option>
            </select>
            <label style={lbl}>Lado</label>
            <select
              value={interestModal.side}
              onChange={(e) =>
                setInterestModal((m) => (m ? { ...m, side: e.target.value as MapInterestPointSide } : m))
              }
              style={inpCompact}
            >
              <option value="TR">TR</option>
              <option value="CT">CT</option>
              <option value="both">both</option>
            </select>
            <label style={lbl}>Ângulo pré-mira (graus, opcional)</label>
            <input
              value={interestModal.aimDeg}
              onChange={(e) => setInterestModal((m) => (m ? { ...m, aimDeg: e.target.value } : m))}
              style={inpCompact}
              placeholder="ex: -90"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setInterestModal(null)}
                style={btnStyle}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = `ip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                  const aim =
                    interestModal.aimDeg.trim() === "" || Number.isNaN(parseFloat(interestModal.aimDeg))
                      ? undefined
                      : (parseFloat(interestModal.aimDeg) * Math.PI) / 180;
                  const pt: MapInterestPoint = {
                    id,
                    x: interestModal.x,
                    y: interestModal.y,
                    type: interestModal.type,
                    side: interestModal.side,
                    aimAngle: aim
                  };
                  setMap((m) => ({
                    ...m,
                    interestPoints: [...(m.interestPoints ?? []), pt]
                  }));
                  setInterestModal(null);
                }}
                style={{ ...btnStyle, background: "#2f6df6", borderColor: "#3b82f6" }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {tacticalModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>Novo spot tático</h3>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              Posição: {tacticalModal.x}, {tacticalModal.y}
            </p>
            <label style={lbl}>Rótulo</label>
            <input
              value={tacticalModal.label}
              onChange={(e) => setTacticalModal((m) => (m ? { ...m, label: e.target.value } : m))}
              style={inpCompact}
            />
            <label style={lbl}>Watch angle (graus)</label>
            <input
              value={tacticalModal.watchDeg}
              onChange={(e) => setTacticalModal((m) => (m ? { ...m, watchDeg: e.target.value } : m))}
              style={inpCompact}
            />
            <label style={lbl}>Lado</label>
            <select
              value={tacticalModal.side}
              onChange={(e) =>
                setTacticalModal((m) =>
                  m ? { ...m, side: e.target.value as "TR" | "CT" | "both" } : m
                )
              }
              style={inpCompact}
            >
              <option value="TR">TR</option>
              <option value="CT">CT</option>
              <option value="both">both</option>
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setTacticalModal(null)} style={btnStyle}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const n = parseFloat(tacticalModal.watchDeg);
                  const watchAngle = Number.isFinite(n) ? (n * Math.PI) / 180 : -Math.PI / 2;
                  const spot: MapTacticalSpot = {
                    x: tacticalModal.x,
                    y: tacticalModal.y,
                    watchAngle,
                    label: tacticalModal.label.trim() || "spot",
                    side: tacticalModal.side
                  };
                  setMap((m) => ({
                    ...m,
                    tacticalSpots: [...(m.tacticalSpots ?? []), spot]
                  }));
                  setTacticalModal(null);
                }}
                style={{ ...btnStyle, background: "#15803d", borderColor: "#22c55e" }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const inpCompact: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "#fff",
  fontSize: 12
};

const lbl: React.CSSProperties = { display: "block", marginTop: 10, marginBottom: 4, color: "#94a3b8" };

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000
};

const modalBox: React.CSSProperties = {
  background: "#131824",
  border: "1px solid #334155",
  borderRadius: 12,
  padding: 24,
  minWidth: 300,
  maxWidth: "90vw",
  color: "#e2e8f0"
};

const btnStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "#1e293b",
  color: "#fff",
  border: "1px solid #334155",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13
};
