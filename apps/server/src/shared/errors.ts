/**
 * Mapeia erros técnicos para mensagens amigáveis ao usuário.
 */
export function toUserFriendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  // Erros de negócio — mensagens em português
  if (msg === "Email already registered") return "Este email já está cadastrado.";
  if (msg === "Invalid email or password") return "Email ou senha incorretos.";
  if (msg.includes("required")) return "Preencha todos os campos obrigatórios.";

  // Erros de conexão com o banco
  if (
    msg.includes("Can't reach database server") ||
    msg.includes("Connection refused") ||
    msg.includes("ECONNREFUSED")
  ) {
    return "Serviço temporariamente indisponível. Verifique se o banco de dados está rodando.";
  }

  if (
    msg.includes("Authentication failed") ||
    msg.includes("password authentication failed")
  ) {
    return "Erro de configuração do banco de dados. Verifique o arquivo .env.";
  }

  if (msg.includes("P1001") || msg.includes("P1000") || msg.includes("P1017")) {
    return "Não foi possível conectar ao banco de dados. Tente novamente em instantes.";
  }

  if (msg.includes("JWT_SECRET")) {
    return "Erro de configuração. Defina JWT_SECRET no .env com pelo menos 32 caracteres.";
  }

  // Erro genérico
  return "Ocorreu um erro inesperado. Tente novamente.";
}
