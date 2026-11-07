// Banco de testes descartável: recriado do zero a cada execução.
// Nunca usa o DATABASE_URL de desenvolvimento.
import { Pool } from "pg";
import { migrate } from "../scripts/db-setup";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://portal:portal@localhost:5433/portal_test";

export async function prepararBancoDeTeste() {
  const url = new URL(TEST_DATABASE_URL);
  const nome = url.pathname.slice(1);
  if (!nome.endsWith("_test")) throw new Error(`Recusado: o banco de testes deve terminar em _test (recebido: ${nome})`);

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = new Pool({ connectionString: adminUrl.toString() });
  await admin.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${nome}`);
  await admin.end();

  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  await migrate(pool, () => {});
  await pool.end();

  // os módulos de src/lib leem DATABASE_URL quando são importados
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}
