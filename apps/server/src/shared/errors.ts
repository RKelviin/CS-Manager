/**
 * Códigos de erro de negócio — estáveis para o cliente e logs.
 */
export const BusinessErrorCode = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  TEAM_FULL: "TEAM_FULL"
} as const;

export type BusinessErrorCodeType = (typeof BusinessErrorCode)[keyof typeof BusinessErrorCode];

const defaultBusinessMessages: Record<BusinessErrorCodeType, string> = {
  [BusinessErrorCode.INSUFFICIENT_BALANCE]: "Insufficient balance",
  [BusinessErrorCode.TEAM_FULL]: "Team roster is full"
};

export class BusinessError extends Error {
  readonly code: BusinessErrorCodeType;

  constructor(code: BusinessErrorCodeType, message?: string) {
    super(message ?? defaultBusinessMessages[code]);
    this.name = "BusinessError";
    this.code = code;
  }
}

export function isBusinessError(err: unknown): err is BusinessError {
  return err instanceof BusinessError;
}

/** Corpo JSON para respostas 400 de regra de negócio. */
export function businessErrorPayload(err: BusinessError): { error: string; code: BusinessErrorCodeType } {
  return { error: toUserFriendlyError(err), code: err.code };
}

/**
 * Mapeia erros técnicos para mensagens amigáveis ao usuário.
 */
export function toUserFriendlyError(err: unknown): string {
  if (isBusinessError(err)) {
    if (err.code === BusinessErrorCode.INSUFFICIENT_BALANCE) return "Saldo insuficiente.";
    if (err.code === BusinessErrorCode.TEAM_FULL) return "O elenco do time está cheio.";
  }

  const msg = err instanceof Error ? err.message : String(err);

  // Erros de negócio — mensagens em português (legado por message string)
  if (msg === "Email already registered") return "Este email já está cadastrado.";
  if (msg === "Invalid email or password") return "Email ou senha incorretos.";
  if (msg.includes("required")) return "Preencha todos os campos obrigatórios.";

  // Erros de conexão com o banco (Prisma / driver)
  if (
    msg.includes("Can't reach database server") ||
    msg.includes("Connection refused") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("P1001") ||
    msg.includes("P1000") ||
    msg.includes("P1017")
  ) {
    return "Não foi possível conectar ao PostgreSQL. Abra o Docker Desktop, na raiz do projeto rode: docker compose up -d, e confira DATABASE_URL em apps/server/.env.";
  }

  if (
    msg.includes("Authentication failed") ||
    msg.includes("password authentication failed")
  ) {
    return "Erro de configuração do banco de dados. Verifique o arquivo .env.";
  }

  if (msg.includes("JWT_SECRET")) {
    return "Erro de configuração. Defina JWT_SECRET no .env com pelo menos 32 caracteres.";
  }

  // Erro genérico
  return "Ocorreu um erro inesperado. Tente novamente.";
}
