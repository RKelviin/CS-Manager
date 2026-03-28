import { useAuth } from "../features/auth";

export const UserPage = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <section>
        <p style={{ color: "#94a3b8" }}>Faça login para acessar seu perfil.</p>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 400 }}>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>Meu perfil</h2>
      <p style={{ color: "#94a3b8", marginBottom: 24, fontSize: 14 }}>
        Dados da sua conta e saldo disponível.
      </p>
      <div
        style={{
          background: "#1a2233",
          padding: 24,
          borderRadius: 12,
          border: "1px solid #2a3142"
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Nome</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{user.name}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Email</div>
          <div style={{ fontSize: 14 }}>{user.email}</div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Saldo</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24" }}>
            ${user.walletBalance.toLocaleString("pt-BR")}
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            padding: "10px 20px",
            border: "1px solid #3f3f46",
            background: "transparent",
            color: "#a1a1aa",
            borderRadius: 8,
            fontSize: 14,
            cursor: "pointer"
          }}
        >
          Sair
        </button>
      </div>
    </section>
  );
};
