"use client";
// Formulário ligado a uma server action que devolve { ok } ou { erro }.
// Usado em todo o admin para mostrar o resultado (ex.: senha temporária gerada).
import { useActionState, useEffect } from "react";

export type Resultado = { ok?: string; erro?: string };

export function FormAcao({
  action,
  children,
  botao,
  className = "stack",
  confirmar,
  estiloBotao,
  aoConcluir,
}: {
  action: (prev: Resultado, form: FormData) => Promise<Resultado>;
  children?: React.ReactNode;
  botao: string;
  className?: string;
  confirmar?: string;
  estiloBotao?: "secundario" | "perigo";
  aoConcluir?: () => void; // chamado após sucesso (o navegador limpa o form; estados locais devem acompanhar)
}) {
  const [state, formAction, pending] = useActionState(action, {});
  useEffect(() => {
    if (state.ok) aoConcluir?.();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      <div>
        <button type="submit" disabled={pending} className={estiloBotao}>
          {pending ? "Salvando…" : botao}
        </button>
      </div>
      {state.ok && <p className="sucesso">{state.ok}</p>}
      {state.erro && <p className="erro">{state.erro}</p>}
    </form>
  );
}
