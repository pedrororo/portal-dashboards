"use client";
import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { erro: "" });
  return (
    <form action={action} className="stack">
      <label>
        E-mail
        <input name="email" type="email" required autoComplete="username" />
      </label>
      <label>
        Senha
        <input name="senha" type="password" required autoComplete="current-password" />
      </label>
      {state.erro && <p className="erro">{state.erro}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
