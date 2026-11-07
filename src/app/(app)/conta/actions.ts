"use server";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { audit, query } from "@/lib/db";
import { hashSenha } from "@/lib/senha";
import type { Resultado } from "@/components/FormAcao";

export async function trocarSenha(_p: Resultado, f: FormData): Promise<Resultado> {
  const u = await requireUser();
  const atual = String(f.get("atual") ?? "");
  const nova = String(f.get("nova") ?? "");
  if (nova.length < 10) return { erro: "A nova senha precisa ter pelo menos 10 caracteres." };

  const [row] = await query<{ senha_hash: string }>("SELECT senha_hash FROM usuarios WHERE id = $1", [u.id]);
  if (!row || !(await bcrypt.compare(atual, row.senha_hash))) return { erro: "Senha atual incorreta." };

  await query("UPDATE usuarios SET senha_hash = $2, trocar_senha = false WHERE id = $1", [u.id, await hashSenha(nova)]);
  await audit(u.id, "senha_trocada");
  return { ok: "Senha alterada." };
}
