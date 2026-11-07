import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";
import { SESSION_COOKIE, readSessionToken } from "./session";

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  papel: "admin" | "viewer";
  cliente_id: number | null;
  cliente_nome: string | null;
  trocar_senha: boolean;
};

// Lê a sessão e confere no banco a cada requisição: usuário desativado
// (ou cliente desativado) perde o acesso na hora, sem esperar o token expirar.
export async function getCurrentUser(): Promise<Usuario | null> {
  const id = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const [u] = await query<Usuario>(
    `SELECT u.id, u.nome, u.email, u.papel, u.cliente_id, c.nome AS cliente_nome, u.trocar_senha
       FROM usuarios u
       LEFT JOIN clientes c ON c.id = u.cliente_id
      WHERE u.id = $1 AND u.ativo AND (u.cliente_id IS NULL OR c.ativo)`,
    [id]
  );
  return u ?? null;
}

// Com senha temporária (gerada pelo admin), nada funciona até o usuário escolher a própria
export async function requireUser(): Promise<Usuario> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.trocar_senha) redirect("/trocar-senha");
  return u;
}

export async function requireAdmin(): Promise<Usuario> {
  const u = await requireUser();
  if (u.papel !== "admin") redirect("/dashboards");
  return u;
}
