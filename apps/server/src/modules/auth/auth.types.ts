export type SignupBody = {
  email: string;
  name: string;
  password: string;
};

export type LoginBody = {
  email: string;
  password: string;
};

export type AuthResponse = {
  user: { id: string; email: string; name: string; walletBalance: number };
  token: string;
};

export type JwtPayload = {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
};
