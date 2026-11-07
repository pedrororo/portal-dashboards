"use server";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit, query } from "@/lib/db";
import { LIMITE_LOGIN, loginBloqueado } from "@/lib/limite";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

// Hash usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails existem
const HASH_FALSO = bcrypt.hashSync("senha-inexistente", 10);

async function ipDaRequisicao() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "desconhecido";
}

export async function login(_prev: { erro: string }, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  const ip = await ipDaRequisicao();

  if (await loginBloqueado(email, ip)) {
    await audit(null, "login_bloqueado", { email, ip });
    return { erro: `Muitas tentativas. Tente novamente em ${LIMITE_LOGIN.janelaMinutos} minutos.` };
  }

  const [u] = await query<{ id: number; senha_hash: string; trocar_senha: boolean }>(
    `SELECT u.id, u.senha_hash, u.trocar_senha
       FROM usuarios u LEFT JOIN clientes c ON c.id = u.cliente_id
      WHERE u.email = $1 AND u.ativo AND (u.cliente_id IS NULL OR c.ativo)`,
    [email]
  );
  const ok = await bcrypt.compare(senha, u?.senha_hash ?? HASH_FALSO);
  if (!u || !ok) {
    await audit(null, "login_falhou", { email, ip });
    return { erro: "E-mail ou senha inválidos." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(u.id), sessionCookieOptions);
  await audit(u.id, "login", { ip });
  redirect(u.trocar_senha ? "/trocar-senha" : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
