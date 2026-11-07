import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function AuditoriaPage() {
  await requireAdmin();
  const eventos = await query<{ id: number; em: Date; quem: string | null; acao: string; detalhe: object | null }>(`
    SELECT a.id, a.em, u.email AS quem, a.acao, a.detalhe
      FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
     ORDER BY a.em DESC LIMIT 200`);

  return (
    <>
      <h1>Auditoria</h1>
      <p className="muted">Últimos 200 eventos: logins, acessos concedidos e revogados, dashboards abertos.</p>
      <div className="tabela">
        <table>
          <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id}>
                <td>{e.em.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                <td>{e.quem ?? "—"}</td>
                <td>{e.acao}</td>
                <td><code>{e.detalhe ? JSON.stringify(e.detalhe) : ""}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
