/**
 * Códigos de erro de negócio — estáveis para o cliente e logs.
 */
export const BusinessErrorCode = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  TEAM_FULL: "TEAM_FULL",
  BET_AMOUNT_OUT_OF_RANGE: "BET_AMOUNT_OUT_OF_RANGE",
  BET_MATCH_NOT_PENDING: "BET_MATCH_NOT_PENDING",
  BET_ALREADY_PLACED: "BET_ALREADY_PLACED",
  BET_INVALID_TEAM: "BET_INVALID_TEAM"
} as const;

export type BusinessErrorCodeType = (typeof BusinessErrorCode)[keyof typeof BusinessErrorCode];

const defaultBusinessMessages: Record<BusinessErrorCodeType, string> = {
  [BusinessErrorCode.INSUFFICIENT_BALANCE]: "Insufficient balance",
  [BusinessErrorCode.TEAM_FULL]: "Team roster is full",
  [BusinessErrorCode.BET_AMOUNT_OUT_OF_RANGE]: "O valor da aposta deve ser entre $100 e $10.000.",
  [BusinessErrorCode.BET_MATCH_NOT_PENDING]: "Esta partida não está disponível para apostas.",
  [BusinessErrorCode.BET_ALREADY_PLACED]: "Você já apostou nesta partida.",
  [BusinessErrorCode.BET_INVALID_TEAM]: "O time apostado não participa desta partida."
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
    if (err.code === BusinessErrorCode.BET_AMOUNT_OUT_OF_RANGE) return "O valor da aposta deve ser entre $100 e $10.000.";
    if (err.code === BusinessErrorCode.BET_MATCH_NOT_PENDING) return "Esta partida não está disponível para apostas.";
    if (err.code === BusinessErrorCode.BET_ALREADY_PLACED) return "Você já apostou nesta partida.";
    if (err.code === BusinessErrorCode.BET_INVALID_TEAM) return "O time apostado não participa desta partida.";
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
