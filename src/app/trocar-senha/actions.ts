"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { audit, query } from "@/lib/db";
import { hashSenha } from "@/lib/senha";
import type { Resultado } from "@/components/FormAcao";

export async function definirNovaSenha(_p: Resultado, f: FormData): Promise<Resultado> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (!u.trocar_senha) redirect("/");

  const nova = String(f.get("nova") ?? "");
  if (nova.length < 10) return { erro: "A nova senha precisa ter pelo menos 10 caracteres." };
  if (nova !== String(f.get("confirmacao") ?? "")) return { erro: "As senhas não conferem." };

  const [atual] = await query<{ senha_hash: string }>("SELECT senha_hash FROM usuarios WHERE id = $1", [u.id]);
  if (await bcrypt.compare(nova, atual.senha_hash)) return { erro: "Escolha uma senha diferente da temporária." };

  await query("UPDATE usuarios SET senha_hash = $2, trocar_senha = false WHERE id = $1", [u.id, await hashSenha(nova)]);
  await audit(u.id, "senha_definida");
  redirect("/");
}
