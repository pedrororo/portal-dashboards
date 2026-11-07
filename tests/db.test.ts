// Regras de acesso e restrições do banco, contra um banco de testes descartável.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prepararBancoDeTeste } from "./helpers";

type Db = typeof import("../src/lib/db");
type Acesso = typeof import("../src/lib/acesso");
type Limite = typeof import("../src/lib/limite");
type Usuario = import("../src/lib/auth").Usuario;

let db: Db, acesso: Acesso, limite: Limite;
const ids = {} as Record<string, number>;

const usuario = (id: number, papel: "admin" | "viewer", cliente_id: number | null): Usuario => ({
  id, papel, cliente_id, nome: "", email: "", cliente_nome: null, trocar_senha: false,
});

before(async () => {
  await prepararBancoDeTeste();
  db = await import("../src/lib/db");
  acesso = await import("../src/lib/acesso");
  limite = await import("../src/lib/limite");
  const one = async (sql: string, p: unknown[]) => (await db.query<{ id: number }>(sql, p))[0].id;

  ids.admin = await one("INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES ('A','a@t','x','admin') RETURNING id", []);
  ids.cA = await one("INSERT INTO clientes (nome,slug) VALUES ('Cliente A','cliente-a') RETURNING id", []);
  ids.cB = await one("INSERT INTO clientes (nome,slug) VALUES ('Cliente B','cliente-b') RETURNING id", []);
  const viewer = (c: number, e: string) =>
    one("INSERT INTO usuarios (cliente_id,nome,email,senha_hash,papel) VALUES ($1,$2,$2,'x','viewer') RETURNING id", [c, e]);
  ids.uA1 = await viewer(ids.cA, "a1@t");
  ids.uA2 = await viewer(ids.cA, "a2@t");
  ids.uB = await viewer(ids.cB, "b@t");
  const dash = (c: number, n: string) =>
    one(`INSERT INTO dashboards (cliente_id,nome,tipo,config) VALUES ($1,$2,'iframe','{"url":"https://x"}') RETURNING id`, [c, n]);
  ids.dA1 = await dash(ids.cA, "A1");
  ids.dA2 = await dash(ids.cA, "A2");
  ids.dB = await dash(ids.cB, "B");
  const conceder = (u: number, d: number, c: number) =>
    db.query("INSERT INTO acessos (usuario_id,dashboard_id,cliente_id) VALUES ($1,$2,$3)", [u, d, c]);
  await conceder(ids.uA1, ids.dA1, ids.cA);
  await conceder(ids.uA1, ids.dA2, ids.cA);
  await conceder(ids.uA2, ids.dA1, ids.cA);
  await conceder(ids.uB, ids.dB, ids.cB);
});

after(async () => {
  await db?.pool.end();
});

describe("restrições do banco", () => {
  it("recusa acesso a dashboard de outro cliente (nos dois sentidos)", async () => {
    await assert.rejects(
      db.query("INSERT INTO acessos (usuario_id,dashboard_id,cliente_id) VALUES ($1,$2,$3)", [ids.uA2, ids.dB, ids.cA]),
      /acessos_dashboard_id_cliente_id_fkey/);
    await assert.rejects(
      db.query("INSERT INTO acessos (usuario_id,dashboard_id,cliente_id) VALUES ($1,$2,$3)", [ids.uA2, ids.dB, ids.cB]),
      /acessos_usuario_id_cliente_id_fkey/);
  });

  it("viewer precisa de cliente e admin não pode ter cliente", async () => {
    await assert.rejects(db.query("INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES ('v','v@t','x','viewer')"), /usuarios_check/);
    await assert.rejects(
      db.query("INSERT INTO usuarios (cliente_id,nome,email,senha_hash,papel) VALUES ($1,'x','x@t','x','admin')", [ids.cA]),
      /usuarios_check/);
  });

  it("recusa tipo de dashboard desconhecido", async () => {
    await assert.rejects(
      db.query("INSERT INTO dashboards (cliente_id,nome,tipo,config) VALUES ($1,'x','powerbi','{}')", [ids.cA]),
      /dashboards_tipo_check/);
  });

  it("excluir um dashboard remove os acessos a ele", async () => {
    const [{ id }] = await db.query<{ id: number }>(
      "INSERT INTO dashboards (cliente_id,nome,tipo,config) VALUES ($1,'tmp','iframe','{}') RETURNING id", [ids.cA]);
    await db.query("INSERT INTO acessos (usuario_id,dashboard_id,cliente_id) VALUES ($1,$2,$3)", [ids.uA2, id, ids.cA]);
    await db.query("DELETE FROM dashboards WHERE id = $1", [id]);
    assert.equal((await db.query("SELECT 1 FROM acessos WHERE dashboard_id = $1", [id])).length, 0);
  });
});

describe("quem vê qual dashboard", () => {
  const nomes = async (u: Usuario) => (await acesso.listDashboards(u)).map((d) => d.nome).sort();

  it("admin vê todos os dashboards de todos os clientes", async () => {
    assert.deepEqual(await nomes(usuario(ids.admin, "admin", null)), ["A1", "A2", "B"]);
  });

  it("viewer vê só o que foi concedido a ele", async () => {
    assert.deepEqual(await nomes(usuario(ids.uA1, "viewer", ids.cA)), ["A1", "A2"]);
    assert.deepEqual(await nomes(usuario(ids.uA2, "viewer", ids.cA)), ["A1"]);
    assert.deepEqual(await nomes(usuario(ids.uB, "viewer", ids.cB)), ["B"]);
  });

  it("abrir um dashboard sem concessão devolve null, mesmo sendo do próprio cliente", async () => {
    const uA2 = usuario(ids.uA2, "viewer", ids.cA);
    assert.ok(await acesso.getDashboard(uA2, ids.dA1));
    assert.equal(await acesso.getDashboard(uA2, ids.dA2), null);
    assert.equal(await acesso.getDashboard(uA2, ids.dB), null);
    assert.equal(await acesso.getDashboard(uA2, Number.NaN), null);
  });

  it("revogar o acesso tira o dashboard na hora", async () => {
    const uA1 = usuario(ids.uA1, "viewer", ids.cA);
    await db.query("DELETE FROM acessos WHERE usuario_id = $1 AND dashboard_id = $2", [ids.uA1, ids.dA2]);
    assert.equal(await acesso.getDashboard(uA1, ids.dA2), null);
    await db.query("INSERT INTO acessos (usuario_id,dashboard_id,cliente_id) VALUES ($1,$2,$3)", [ids.uA1, ids.dA2, ids.cA]);
  });
});

describe("limite de tentativas de login", () => {
  const falhar = (email: string, ip: string, vezes: number) =>
    Promise.all(Array.from({ length: vezes }, () => db.audit(null, "login_falhou", { email, ip })));

  it("bloqueia o e-mail após 5 falhas na janela", async () => {
    await falhar("alvo@t", "10.0.0.1", 4);
    assert.equal(await limite.loginBloqueado("alvo@t", "10.0.0.9"), false);
    await falhar("alvo@t", "10.0.0.2", 1);
    assert.equal(await limite.loginBloqueado("alvo@t", "10.0.0.9"), true);
    assert.equal(await limite.loginBloqueado("outro@t", "10.0.0.9"), false);
  });

  it("bloqueia o IP após 20 falhas, mesmo com e-mails diferentes", async () => {
    for (let i = 0; i < 20; i++) await falhar(`e${i}@t`, "10.9.9.9", 1);
    assert.equal(await limite.loginBloqueado("novo@t", "10.9.9.9"), true);
    assert.equal(await limite.loginBloqueado("novo@t", "10.9.9.8"), false);
  });

  it("falhas antigas (fora da janela) não contam", async () => {
    await falhar("antigo@t", "10.1.1.1", 5);
    await db.query("UPDATE auditoria SET em = now() - interval '16 minutes' WHERE detalhe->>'email' = 'antigo@t'");
    assert.equal(await limite.loginBloqueado("antigo@t", "10.1.1.2"), false);
  });
});
