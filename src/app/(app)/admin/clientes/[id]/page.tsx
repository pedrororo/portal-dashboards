import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { FormAcao } from "@/components/FormAcao";
import {
  alternarCliente, alternarUsuario, criarDataset, criarUsuario, excluirDashboard, redefinirSenha,
} from "../../actions";
import { NovoDashboardForm } from "./NovoDashboardForm";

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [cliente] = await query<{ id: number; nome: string; ativo: boolean }>(
    "SELECT id, nome, ativo FROM clientes WHERE id = $1", [id]);
  if (!cliente) notFound();

  const [usuarios, datasets, dashboards] = await Promise.all([
    query<{ id: number; nome: string; email: string; ativo: boolean; acessos: number }>(`
      SELECT u.id, u.nome, u.email, u.ativo,
             (SELECT count(*) FROM acessos a WHERE a.usuario_id = u.id)::int AS acessos
        FROM usuarios u WHERE u.cliente_id = $1 ORDER BY u.nome`, [id]),
    query<{ id: number; nome: string; colunas: string[]; n: number }>(`
      SELECT id, nome, colunas, jsonb_array_length(linhas) AS n
        FROM datasets WHERE cliente_id = $1 ORDER BY nome`, [id]),
    query<{ id: number; nome: string; tipo: string; usuarios: number }>(`
      SELECT d.id, d.nome, d.tipo,
             (SELECT count(*) FROM acessos a WHERE a.dashboard_id = d.id)::int AS usuarios
        FROM dashboards d WHERE d.cliente_id = $1 ORDER BY d.nome`, [id]),
  ]);

  return (
    <>
      <p><Link href="/admin">← Clientes</Link></p>
      <div className="linha" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>{cliente.nome}</h1>
          <span className="tag">{cliente.ativo ? "ativo" : "inativo"}</span>
        </div>
        <FormAcao
          action={alternarCliente}
          botao={cliente.ativo ? "Desativar cliente" : "Ativar cliente"}
          estiloBotao={cliente.ativo ? "perigo" : "secundario"}
          confirmar={cliente.ativo ? "Desativar o cliente bloqueia o login de todos os usuários dele. Continuar?" : undefined}
        >
          <input type="hidden" name="cliente_id" value={id} />
        </FormAcao>
      </div>

      <h2>Usuários</h2>
      <div className="tabela">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Dashboards liberados</th><th>Ações</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}{!u.ativo && <> <span className="tag">inativo</span></>}</td>
                <td>{u.email}</td>
                <td>
                  {u.acessos} · <Link href={`/admin/clientes/${id}/usuarios/${u.id}`}>definir acessos</Link>
                </td>
                <td>
                  <div className="linha">
                    <FormAcao action={redefinirSenha} botao="Nova senha" estiloBotao="secundario" className="stack">
                      <input type="hidden" name="usuario_id" value={u.id} />
                    </FormAcao>
                    <FormAcao action={alternarUsuario} botao={u.ativo ? "Desativar" : "Ativar"} estiloBotao={u.ativo ? "perigo" : "secundario"} className="stack">
                      <input type="hidden" name="usuario_id" value={u.id} />
                    </FormAcao>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && <tr><td colSpan={4} className="muted">Nenhum usuário.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: "0.75rem" }}>
        <FormAcao action={criarUsuario} botao="Criar usuário" className="linha">
          <input type="hidden" name="papel" value="viewer" />
          <input type="hidden" name="cliente_id" value={id} />
          <label>Nome<input name="nome" required /></label>
          <label>E-mail<input name="email" type="email" required /></label>
        </FormAcao>
      </div>

      <h2>Dados (datasets)</h2>
      <p className="muted">CSV com cabeçalho; separador “;” ou “,”. Os dados ficam no banco e só são enviados a quem tem acesso.</p>
      <ul>
        {datasets.map((d) => (
          <li key={d.id}>{d.nome} — {d.n} linhas · colunas: {d.colunas.join(", ")}</li>
        ))}
        {datasets.length === 0 && <li className="muted">Nenhum dataset.</li>}
      </ul>
      <div className="card">
        <FormAcao action={criarDataset} botao="Importar CSV" className="linha">
          <input type="hidden" name="cliente_id" value={id} />
          <label>Arquivo<input name="arquivo" type="file" accept=".csv,text/csv" required /></label>
          <label>Nome (opcional)<input name="nome" /></label>
        </FormAcao>
      </div>

      <h2>Dashboards</h2>
      <div className="tabela">
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th><th>Usuários com acesso</th><th></th></tr></thead>
          <tbody>
            {dashboards.map((d) => (
              <tr key={d.id}>
                <td><Link href={`/dashboards/${d.id}`}>{d.nome}</Link></td>
                <td><span className="tag">{d.tipo}</span></td>
                <td>{d.usuarios}</td>
                <td>
                  <FormAcao action={excluirDashboard} botao="Excluir" estiloBotao="perigo" className="stack"
                    confirmar={`Excluir "${d.nome}"? Os acessos a ele também serão removidos.`}>
                    <input type="hidden" name="dashboard_id" value={d.id} />
                  </FormAcao>
                </td>
              </tr>
            ))}
            {dashboards.length === 0 && <tr><td colSpan={4} className="muted">Nenhum dashboard.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: "0.75rem" }}>
        <NovoDashboardForm clienteId={id} datasets={datasets.map(({ id, nome, colunas }) => ({ id, nome, colunas }))} />
      </div>
    </>
  );
}
