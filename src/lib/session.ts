// Token de sessão assinado (JWT HS256) guardado em cookie httpOnly.
// Este arquivo não usa o banco, então pode rodar também no middleware (edge).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sessao";
const DURACAO_SEGUNDOS = 60 * 60 * 8; // 8 horas

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET ausente ou curto demais (mín. 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(usuarioId: number) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(usuarioId))
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(secret());
}

export async function readSessionToken(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DURACAO_SEGUNDOS,
};
