import { Pool } from "pg";

// Uma única pool por processo (evita abrir conexões novas a cada hot reload em dev)
const globalForPool = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForPool.pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForPool.pool = pool;

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

export async function audit(usuarioId: number | null, acao: string, detalhe?: object) {
  await pool.query("INSERT INTO auditoria (usuario_id, acao, detalhe) VALUES ($1, $2, $3)", [
    usuarioId,
    acao,
    detalhe ? JSON.stringify(detalhe) : null,
  ]);
}
