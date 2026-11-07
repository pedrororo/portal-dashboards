import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FormAcao } from "@/components/FormAcao";
import { definirNovaSenha } from "./actions";

// Fora do grupo (app) de propósito: requireUser() manda para cá quem tem senha temporária
export default async function TrocarSenhaPage() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (!u.trocar_senha) redirect("/");
  return (
    <main className="login">
      <div className="card login-card">
        <h1>Escolha sua senha</h1>
        <p className="muted">
          Olá, {u.nome}. Você entrou com uma senha temporária; defina uma senha sua para continuar.
        </p>
        <FormAcao action={definirNovaSenha} botao="Salvar e continuar">
          <label>Nova senha (mín. 10 caracteres)<input name="nova" type="password" required minLength={10} autoComplete="new-password" /></label>
          <label>Repita a nova senha<input name="confirmacao" type="password" required minLength={10} autoComplete="new-password" /></label>
        </FormAcao>
      </div>
    </main>
  );
}
