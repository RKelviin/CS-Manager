export const MatchLogs = ({
  logs,
  tickOrderFooter
}: {
  logs: string[];
  /** Texto opcional exibido abaixo da lista de logs */
  tickOrderFooter?: string;
}) => {
  return (
    <div style={{ border: "1px solid #2a3142", borderRadius: 10, padding: 10, background: "#111722" }}>
      <h3 style={{ marginTop: 0 }}>Logs</h3>
      <div style={{ display: "grid", gap: 6, color: "#c0ceee", fontSize: 13 }}>
        {logs.map((log, index) => (
          <div key={`${log}-${index}`}>{log}</div>
        ))}
      </div>
      {tickOrderFooter ? (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid #2a3142",
            fontSize: 12,
            color: "#6b7a99",
            lineHeight: 1.45
          }}
        >
          {tickOrderFooter}
        </div>
      ) : null}
    </div>
  );
};
