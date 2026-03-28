import { useState } from "react";
import { useAuth } from "../features/auth";

export const AuthPage = () => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await signup(email.trim(), name.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ maxWidth: 360 }}>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>{mode === "login" ? "Entrar" : "Cadastro"}</h2>
      <p style={{ color: "#94a3b8", marginBottom: 24, fontSize: 14 }}>
        Acesse sua conta ou crie uma nova.
      </p>
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => { setMode("login"); setError(""); }}
          style={{
            padding: "8px 16px",
            marginRight: 8,
            border: mode === "login" ? "none" : "1px solid #2a3142",
            background: mode === "login" ? "#2f6df6" : "#171b23",
            color: mode === "login" ? "#fff" : "#94a3b8",
            borderRadius: 8,
            fontSize: 14,
            cursor: "pointer"
          }}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setError(""); }}
          style={{
            padding: "8px 16px",
            border: mode === "signup" ? "none" : "1px solid #2a3142",
            background: mode === "signup" ? "#2f6df6" : "#171b23",
            color: mode === "signup" ? "#fff" : "#94a3b8",
            borderRadius: 8,
            fontSize: 14,
            cursor: "pointer"
          }}
        >
          Cadastro
        </button>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #2a3142",
            background: "#171b23",
            color: "#eef2ff",
            fontSize: 14
          }}
          required
        />
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #2a3142",
              background: "#171b23",
              color: "#eef2ff",
              fontSize: 14
            }}
            required
          />
        )}
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #2a3142",
            background: "#171b23",
            color: "#eef2ff",
            fontSize: 14
          }}
          required
        />
        {error && <p style={{ color: "#e74c3c", margin: 0, fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 16px",
            border: "none",
            background: "#2f6df6",
            color: "#fff",
            fontWeight: 600,
            borderRadius: 8,
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "..." : mode === "login" ? "Entrar" : "Cadastrar"}
        </button>
      </form>
    </section>
  );
};
