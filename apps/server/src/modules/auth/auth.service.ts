import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/index.js";
import { createDefaultTeamForUser } from "../team/team.service.js";
import type { SignupBody, LoginBody, AuthResponse, JwtPayload } from "./auth.types.js";

const SALT_ROUNDS = 10;
const JWT_EXPIRES = "7d";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return secret;
}

export async function signup(body: SignupBody): Promise<AuthResponse> {
  const { email, name, password } = body;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new Error("Email already registered");
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name.trim(),
      password: hash,
      walletBalance: 1000
    }
  });

  await createDefaultTeamForUser(user.id);

  const token = jwt.sign(
    { sub: user.id, email: user.email } as Omit<JwtPayload, "iat" | "exp">,
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES }
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      walletBalance: user.walletBalance
    },
    token
  };
}

export async function login(body: LoginBody): Promise<AuthResponse> {
  const { email, password } = body;
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email } as Omit<JwtPayload, "iat" | "exp">,
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES }
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      walletBalance: user.walletBalance
    },
    token
  };
}

export function verifyToken(token: string): JwtPayload {
  const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
  if (!payload.sub) throw new Error("Invalid token");
  return payload;
}
