"use server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { audit, query } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

// Hash usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails existem
const HASH_FALSO = bcrypt.hashSync("senha-inexistente", 10);

export async function login(_prev: { erro: string }, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");

  const [u] = await query<{ id: number; senha_hash: string }>(
    `SELECT u.id, u.senha_hash
       FROM usuarios u LEFT JOIN clientes c ON c.id = u.cliente_id
      WHERE u.email = $1 AND u.ativo AND (u.cliente_id IS NULL OR c.ativo)`,
    [email]
  );
  const ok = await bcrypt.compare(senha, u?.senha_hash ?? HASH_FALSO);
  if (!u || !ok) {
    await audit(null, "login_falhou", { email });
    return { erro: "E-mail ou senha inválidos." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(u.id), sessionCookieOptions);
  await audit(u.id, "login");
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
