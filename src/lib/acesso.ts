import "server-only";
import { query } from "./db";
import type { Usuario } from "./auth";

export type Dashboard = {
  id: number;
  cliente_id: number;
  cliente_nome: string;
  cliente_slug: string;
  nome: string;
  descricao: string | null;
  tipo: "interno" | "iframe" | "metabase";
  config: {
    dataset_id?: number; grafico?: "linha" | "barra"; x?: number; y?: number[]; // interno
    url?: string;                                                               // iframe
    dashboard?: number; parametro_cliente?: string;                             // metabase
  };
};

// A regra do portal, num lugar só:
//   admin  -> vê todos os dashboards
//   viewer -> só os que estão em "acessos" para ele
const SELECT = `
  SELECT d.id, d.cliente_id, c.nome AS cliente_nome, c.slug AS cliente_slug, d.nome, d.descricao, d.tipo, d.config
    FROM dashboards d JOIN clientes c ON c.id = d.cliente_id`;

export async function listDashboards(u: Usuario): Promise<Dashboard[]> {
  if (u.papel === "admin") return query<Dashboard>(`${SELECT} ORDER BY c.nome, d.nome`);
  return query<Dashboard>(
    `${SELECT} JOIN acessos a ON a.dashboard_id = d.id
      WHERE a.usuario_id = $1 ORDER BY d.nome`,
    [u.id]
  );
}

export async function getDashboard(u: Usuario, id: number): Promise<Dashboard | null> {
  if (!Number.isInteger(id)) return null;
  const rows =
    u.papel === "admin"
      ? await query<Dashboard>(`${SELECT} WHERE d.id = $1`, [id])
      : await query<Dashboard>(
          `${SELECT} JOIN acessos a ON a.dashboard_id = d.id
            WHERE d.id = $1 AND a.usuario_id = $2`,
          [id, u.id]
        );
  return rows[0] ?? null;
}
