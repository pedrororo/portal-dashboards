import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listDashboards } from "@/lib/acesso";

export default async function DashboardsPage() {
  const u = await requireUser();
  const dashboards = await listDashboards(u);

  return (
    <>
      <h1>Dashboards</h1>
      <p className="muted">
        {u.papel === "admin" ? "Como admin, você vê os dashboards de todos os clientes." : "Dashboards liberados para você."}
      </p>
      {dashboards.length === 0 ? (
        <div className="card">
          <p>Nenhum dashboard liberado ainda. Fale com o administrador para pedir acesso.</p>
        </div>
      ) : (
        <div className="grid">
          {dashboards.map((d) => (
            <Link key={d.id} href={`/dashboards/${d.id}`} className="card">
              <strong>{d.nome}</strong>
              {u.papel === "admin" && <div className="muted">{d.cliente_nome}</div>}
              {d.descricao && <p className="muted">{d.descricao}</p>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
