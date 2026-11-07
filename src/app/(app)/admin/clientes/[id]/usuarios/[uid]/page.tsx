import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { FormAcao } from "@/components/FormAcao";
import { salvarAcessos } from "../../../../actions";

export default async function AcessosPage({ params }: { params: Promise<{ id: string; uid: string }> }) {
  await requireAdmin();
  const { id, uid } = await params;
  const clienteId = Number(id);
  const usuarioId = Number(uid);

  const [u] = await query<{ nome: string; email: string; cliente_nome: string }>(`
    SELECT u.nome, u.email, c.nome AS cliente_nome
      FROM usuarios u JOIN clientes c ON c.id = u.cliente_id
     WHERE u.id = $1 AND u.cliente_id = $2`, [usuarioId, clienteId]);
  if (!u) notFound();

  // só dashboards do cliente do usuário aparecem como opção
  const dashboards = await query<{ id: number; nome: string; tipo: string; liberado: boolean }>(`
    SELECT d.id, d.nome, d.tipo,
           EXISTS (SELECT 1 FROM acessos a WHERE a.dashboard_id = d.id AND a.usuario_id = $1) AS liberado
      FROM dashboards d WHERE d.cliente_id = $2 ORDER BY d.nome`, [usuarioId, clienteId]);

  return (
    <>
      <p><Link href={`/admin/clientes/${clienteId}`}>← {u.cliente_nome}</Link></p>
      <h1>Acessos de {u.nome}</h1>
      <p className="muted">{u.email} · marque os dashboards que este usuário pode ver.</p>
      <div className="card">
        {dashboards.length === 0 ? (
          <p className="muted">Este cliente ainda não tem dashboards.</p>
        ) : (
          <FormAcao action={salvarAcessos} botao="Salvar acessos">
            <input type="hidden" name="usuario_id" value={usuarioId} />
            <div className="checks">
              {dashboards.map((d) => (
                <label key={d.id}>
                  <input type="checkbox" name="dashboard_id" value={d.id} defaultChecked={d.liberado} />
                  {d.nome} <span className="tag">{d.tipo}</span>
                </label>
              ))}
            </div>
          </FormAcao>
        )}
      </div>
    </>
  );
}
