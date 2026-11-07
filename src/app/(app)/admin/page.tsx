import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { FormAcao } from "@/components/FormAcao";
import { criarCliente, criarUsuario } from "./actions";

type Linha = { id: number; nome: string; ativo: boolean; usuarios: number; dashboards: number; acessos: number };

export default async function AdminPage() {
  await requireAdmin();
  const clientes = await query<Linha>(`
    SELECT c.id, c.nome, c.ativo,
           (SELECT count(*) FROM usuarios   u WHERE u.cliente_id = c.id)::int AS usuarios,
           (SELECT count(*) FROM dashboards d WHERE d.cliente_id = c.id)::int AS dashboards,
           (SELECT count(*) FROM acessos    a WHERE a.cliente_id = c.id)::int AS acessos
      FROM clientes c ORDER BY c.nome`);
  const admins = await query<{ id: number; nome: string; email: string; ativo: boolean }>(
    "SELECT id, nome, email, ativo FROM usuarios WHERE papel = 'admin' ORDER BY nome");

  return (
    <>
      <h1>Clientes</h1>
      <p className="muted">Cada cliente tem seus usuários, dados e dashboards. Só o admin concede acesso.</p>

      <div className="tabela">
        <table>
          <thead>
            <tr><th>Cliente</th><th>Usuários</th><th>Dashboards</th><th>Acessos concedidos</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/clientes/${c.id}`}>{c.nome}</Link></td>
                <td>{c.usuarios}</td>
                <td>{c.dashboards}</td>
                <td>{c.acessos}</td>
                <td><span className="tag">{c.ativo ? "ativo" : "inativo"}</span></td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr><td colSpan={5} className="muted">Nenhum cliente ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>Novo cliente</h2>
      <div className="card">
        <FormAcao action={criarCliente} botao="Criar cliente" className="linha">
          <label>Nome<input name="nome" required placeholder="Ex.: Granja São Francisco" /></label>
        </FormAcao>
      </div>

      <h2>Administradores</h2>
      <p className="muted">Admins veem todos os clientes e são os únicos que concedem acesso.</p>
      <ul>
        {admins.map((a) => (
          <li key={a.id}>{a.nome} — {a.email}{a.ativo ? "" : " (inativo)"}</li>
        ))}
      </ul>
      <div className="card">
        <FormAcao action={criarUsuario} botao="Criar admin" className="linha">
          <input type="hidden" name="papel" value="admin" />
          <label>Nome<input name="nome" required /></label>
          <label>E-mail<input name="email" type="email" required /></label>
        </FormAcao>
      </div>
    </>
  );
}
