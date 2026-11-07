import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/acesso";
import { audit, query } from "@/lib/db";
import { Grafico } from "@/components/Grafico";

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const d = await getDashboard(u, Number((await params).id));
  // sem acesso = mesma resposta de "não existe" (não revela dashboards de outros clientes)
  if (!d) notFound();
  await audit(u.id, "dashboard_aberto", { dashboard_id: d.id });

  let conteudo: React.ReactNode;
  if (d.tipo === "iframe") {
    conteudo = (
      <iframe
        src={d.config.url}
        title={d.nome}
        className="painel-iframe"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerPolicy="no-referrer"
      />
    );
  } else {
    // os dados saem do banco só aqui, depois da checagem de acesso acima
    const [ds] = await query<{ colunas: string[]; linhas: (string | number | null)[][] }>(
      "SELECT colunas, linhas FROM datasets WHERE id = $1 AND cliente_id = $2",
      [d.config.dataset_id, d.cliente_id]
    );
    conteudo = ds ? (
      <div className="card">
        <Grafico
          tipo={d.config.grafico ?? "linha"}
          colunas={ds.colunas}
          linhas={ds.linhas}
          x={d.config.x ?? 0}
          y={d.config.y ?? [1]}
        />
      </div>
    ) : (
      <p className="erro">O dataset deste dashboard não existe mais.</p>
    );
  }

  return (
    <>
      <p><Link href="/dashboards">← Dashboards</Link></p>
      <h1>{d.nome}</h1>
      <p className="muted">
        {u.papel === "admin" && `${d.cliente_nome} · `}
        {d.descricao}
      </p>
      {conteudo}
    </>
  );
}
