// Aplica, em ordem, as migrations de db/migrations que ainda não rodaram neste banco.
// Uso: npm run db:setup
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const DIR = join(__dirname, "..", "db", "migrations");

export async function migrate(pool: Pool, log = console.log) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await pool.query<{ nome: string }>("SELECT nome FROM schema_migrations");
  const feitas = new Set(rows.map((r) => r.nome));

  for (const nome of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
    if (feitas.has(nome)) continue;
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(readFileSync(join(DIR, nome), "utf8"));
      await c.query("INSERT INTO schema_migrations (nome) VALUES ($1)", [nome]);
      await c.query("COMMIT");
      log(`Migration aplicada: ${nome}`);
    } catch (e) {
      await c.query("ROLLBACK");
      throw new Error(`Falha na migration ${nome}: ${(e as Error).message}`);
    } finally {
      c.release();
    }
  }
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  migrate(pool)
    .then(() => console.log("Banco atualizado."))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
