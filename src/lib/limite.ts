// Limite de tentativas de login, contado a partir dos "login_falhou" da auditoria.
// Por ficar no banco, vale mesmo com várias instâncias do servidor.
import { query } from "./db";

export const LIMITE_LOGIN = {
  janelaMinutos: 15,
  porEmail: 5,  // protege cada conta contra adivinhação de senha
  porIp: 20,    // freia quem testa muitos e-mails a partir do mesmo endereço
};

export async function loginBloqueado(email: string, ip: string): Promise<boolean> {
  const [r] = await query<{ email: number; ip: number }>(
    `SELECT count(*) FILTER (WHERE detalhe->>'email' = $1)::int AS email,
            count(*) FILTER (WHERE detalhe->>'ip' = $2)::int    AS ip
       FROM auditoria
      WHERE acao = 'login_falhou' AND em > now() - make_interval(mins => $3)`,
    [email, ip, LIMITE_LOGIN.janelaMinutos]
  );
  return r.email >= LIMITE_LOGIN.porEmail || r.ip >= LIMITE_LOGIN.porIp;
}
