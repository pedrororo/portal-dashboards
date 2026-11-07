import { requireUser } from "@/lib/auth";
import { FormAcao } from "@/components/FormAcao";
import { trocarSenha } from "./actions";

export default async function ContaPage() {
  const u = await requireUser();
  return (
    <>
      <h1>Minha conta</h1>
      <p className="muted">{u.nome} · {u.email}</p>
      <h2>Trocar senha</h2>
      <div className="card" style={{ maxWidth: 420 }}>
        <FormAcao action={trocarSenha} botao="Trocar senha">
          <label>Senha atual<input name="atual" type="password" required autoComplete="current-password" /></label>
          <label>Nova senha (mín. 10 caracteres)<input name="nova" type="password" required minLength={10} autoComplete="new-password" /></label>
        </FormAcao>
      </div>
    </>
  );
}
