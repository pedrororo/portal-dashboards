// Cria o admin (ADMIN_EMAIL / ADMIN_PASSWORD do .env) e dois clientes de demonstração
// com séries sintéticas no formato do Cepea (scripts/gerar-dados-demo.ts). Só roda com o banco vazio. Uso: npm run db:seed
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { parseCsv } from "../src/lib/csv";
import { gerarSenhaTemporaria, hashSenha } from "../src/lib/senha";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const dataDir = join(__dirname, "..", "seed", "data");
const ler = (arquivo: string) => parseCsv(readFileSync(join(dataDir, arquivo), "utf8"));

// Junta várias séries (Data;Preço) em uma tabela: Data;PR;SC;...
function juntarSeries(series: Record<string, string>) {
  const porData = new Map<string, Record<string, number | null>>();
  for (const [nome, arquivo] of Object.entries(series)) {
    for (const [data, valor] of ler(arquivo).linhas) {
      const k = String(data);
      porData.set(k, { ...porData.get(k), [nome]: typeof valor === "number" ? valor : null });
    }
  }
  const nomes = Object.keys(series);
  const ordem = (d: string) => d.split("/").reverse().join("");
  const linhas = [...porData.entries()]
    .sort(([a], [b]) => ordem(a).localeCompare(ordem(b)))
    .map(([data, v]) => [data, ...nomes.map((n) => v[n] ?? null)]);
  return { colunas: ["Data", ...nomes], linhas };
}

async function main() {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM clientes");
  if (rows[0].n > 0) {
    console.log("O banco já tem clientes; seed não executado.");
    return;
  }
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env");

  const c = await pool.connect();
  const senhas: string[] = [];
  try {
    await c.query("BEGIN");
    const one = async <T>(sql: string, p: unknown[]) => (await c.query(sql, p)).rows[0] as T;

    const admin = await one<{ id: number }>(
      `INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ('Administrador', $1, $2, 'admin')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
      [ADMIN_EMAIL.toLowerCase(), await hashSenha(ADMIN_PASSWORD)]);

    async function cliente(nome: string, slug: string) {
      return (await one<{ id: number }>("INSERT INTO clientes (nome, slug) VALUES ($1, $2) RETURNING id", [nome, slug])).id;
    }
    async function dataset(clienteId: number, nome: string, t: { colunas: string[]; linhas: unknown[][] }) {
      return (await one<{ id: number }>(
        "INSERT INTO datasets (cliente_id, nome, colunas, linhas) VALUES ($1, $2, $3, $4) RETURNING id",
        [clienteId, nome, JSON.stringify(t.colunas), JSON.stringify(t.linhas)])).id;
    }
    async function dashboard(clienteId: number, nome: string, descricao: string, config: object) {
      return (await one<{ id: number }>(
        `INSERT INTO dashboards (cliente_id, nome, descricao, tipo, config) VALUES ($1, $2, $3, 'interno', $4) RETURNING id`,
        [clienteId, nome, descricao, JSON.stringify(config)])).id;
    }
    async function usuario(clienteId: number, nome: string, email: string) {
      const senha = gerarSenhaTemporaria();
      senhas.push(`${email}  ${senha}`);
      return (await one<{ id: number }>(
        `INSERT INTO usuarios (cliente_id, nome, email, senha_hash, papel) VALUES ($1, $2, $3, $4, 'viewer') RETURNING id`,
        [clienteId, nome, email, await hashSenha(senha)])).id;
    }
    async function conceder(usuarioId: number, clienteId: number, dashboardIds: number[]) {
      for (const d of dashboardIds) {
        await c.query(
          "INSERT INTO acessos (usuario_id, dashboard_id, cliente_id, concedido_por) VALUES ($1, $2, $3, $4)",
          [usuarioId, d, clienteId, admin.id]);
      }
    }

    // Cliente 1: suinocultura, com dois usuários de acessos diferentes
    const granja = await cliente("Granja Demo", "granja-demo");
    const dsSul = await dataset(granja, "Suíno vivo — Sul", juntarSeries({ PR: "suino_PR.csv", SC: "suino_SC.csv", RS: "suino_RS.csv" }));
    const dsSudeste = await dataset(granja, "Suíno vivo — Sudeste", juntarSeries({ SP: "suino_SP.csv", MG: "suino_MG.csv" }));
    const dSul = await dashboard(granja, "Suíno vivo — Sul", "Série sintética, R$/kg, PR · SC · RS", { dataset_id: dsSul, grafico: "linha", x: 0, y: [1, 2, 3] });
    const dSudeste = await dashboard(granja, "Suíno vivo — Sudeste", "Série sintética, R$/kg, SP · MG", { dataset_id: dsSudeste, grafico: "linha", x: 0, y: [1, 2] });
    const gerente = await usuario(granja, "Gerente Granja", "gerente@granja.demo");
    const tecnico = await usuario(granja, "Técnico Granja", "tecnico@granja.demo");
    await conceder(gerente, granja, [dSul, dSudeste]);
    await conceder(tecnico, granja, [dSul]);

    // Cliente 2: cerealista
    const cereal = await cliente("Cerealista Demo", "cerealista-demo");
    const dsMilho = await dataset(cereal, "Milho", ler("milho.csv"));
    const dsDolar = await dataset(cereal, "Dólar", ler("dolar.csv"));
    const dMilho = await dashboard(cereal, "Milho", "Série sintética, R$ e US$ por saca", { dataset_id: dsMilho, grafico: "linha", x: 0, y: [1] });
    const dDolar = await dashboard(cereal, "Dólar", "Dólar à vista (R$)", { dataset_id: dsDolar, grafico: "linha", x: 0, y: [1] });
    const comprador = await usuario(cereal, "Comprador Cerealista", "compras@cerealista.demo");
    await conceder(comprador, cereal, [dMilho, dDolar]);

    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }

  console.log("Seed concluído. Admin:", ADMIN_EMAIL);
  console.log("Usuários de demonstração (senhas temporárias):");
  for (const s of senhas) console.log("  " + s);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
