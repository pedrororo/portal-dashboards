"use server";
// Todas as operações do admin. Cada uma começa com requireAdmin(): mesmo que alguém
// chame a action diretamente, sem ser admin, nada acontece.
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { audit, pool, query } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { gerarSenhaTemporaria, hashSenha } from "@/lib/senha";
import type { Resultado } from "@/components/FormAcao";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number.parseInt(txt(f, k), 10);

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function erroBanco(e: unknown): Resultado {
  const code = (e as { code?: string }).code;
  if (code === "23505") return { erro: "Já existe um registro com esse valor (e-mail ou nome repetido)." };
  if (code === "23503") return { erro: "Referência inválida (registro de outro cliente ou inexistente)." };
  console.error(e);
  return { erro: "Erro ao salvar. Veja o log do servidor." };
}

/* ── Clientes ─────────────────────────────────────────────────────────── */

export async function criarCliente(_p: Resultado, f: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  const nome = txt(f, "nome");
  if (!nome) return { erro: "Informe o nome do cliente." };
  try {
    const [c] = await query<{ id: number }>(
      "INSERT INTO clientes (nome, slug) VALUES ($1, $2) RETURNING id", [nome, slugify(nome)]);
    await audit(admin.id, "cliente_criado", { cliente_id: c.id, nome });
  } catch (e) { return erroBanco(e); }
  revalidatePath("/admin");
  return { ok: `Cliente "${nome}" criado.` };
}

export async function alternarCliente(_p: Resultado, f: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  const id = int(f, "cliente_id");
  const [c] = await query<{ ativo: boolean }>(
    "UPDATE clientes SET ativo = NOT ativo WHERE id = $1 RETURNING ativo", [id]);
  if (!c) return { erro: "Cliente não encontrado." };
  await audit(admin.id, c.ativo ? "cliente_ativado" : "cliente_desativado", { cliente_id: id });
  revalidatePath(`/admin/clientes/${id}`);
  revalidatePath("/admin");
  return { ok: c.ativo ? "Cliente ativado." : "Cliente desativado: os usuários dele não entram mais." };
}

/* ── Usuários ─────────────────────────────────────────────────────────── */

export async function criarUsuario(_p: Resultado, f: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  const nome = txt(f, "nome");
  const email = txt(f, "email").toLowerCase();
  const papel = txt(f, "papel") === "admin" ? "admin" : "viewer";
  const clienteId = papel === "viewer" ? int(f, "cliente_id") : null;
  if (!nome || !email) return { erro: "Informe nome e e-mail." };
  if (papel === "viewer" && !Number.isInteger(clienteId)) return { erro: "Usuário viewer precisa de um cliente." };

  const senha = gerarSenhaTemporaria();
  try {
    const [u] = await query<{ id: number }>(
      `INSERT INTO usuarios (cliente_id, nome, email, senha_hash, papel)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [clienteId, nome, email, await hashSenha(senha), papel]);
    await audit(admin.id, "usuario_criado", { usuario_id: u.id, email, papel, cliente_id: clienteId });
  } catch (e) { return erroBanco(e); }
  revalidatePath(clienteId ? `/admin/clientes/${clienteId}` : "/admin");
  return { ok: `Usuário criado. Senha temporária de ${email}: ${senha} — copie agora, ela não será mostrada de novo.` };
}

export async function redefinirSenha(_p: Resultado, f: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  const id = int(f, "usuario_id");
  const senha = gerarSenhaTemporaria();
  const [u] = await query<{ email: string }>(
    "UPDATE usuarios SET senha_hash = $2 WHERE id = $1 RETURNING email", [id, await hashSenha(senha)]);
  if (!u) return { erro: "Usuário não encontrado." };
  await audit(admin.id, "senha_redefinida", { usuario_id: id });
  return { ok: `Nova senha temporária de ${u.email}: ${senha}` };
}

export async function alternarUsuario(_p: Resultado, f: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  const id = int(f, "usuario_id");
  if (id === admin.id) return { erro: "Você não pode desativar a si mesmo." };
  const [u] = await query<{ ativo: boolean; cliente_id: number | null }>(
    "UPDATE usuarios SET ativo = NOT ativo WHERE id = $1 RETURNING ativo, cliente_id", [id]);
  if (!u) return { erro: "Usuário não encontrado." };
  await audit(admin.id, u.ativo ? "usuario_ativado" : "usuario_desativado", { usuario_id: id });
  revalidatePath(u.cliente_id ? `/admin/clientes/${u.cliente_id}` : "/admin");
  return { ok: u.ativo ? "Usuário ativado." : "Usuário desativado." };
}

/* ── Datasets e dashboards ────────────────────────────────────────────── */

export async function criarDataset(_p: Resultado, f: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  const clienteId = int(f, "cliente_id");
  const arquivo = f.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha um arquivo CSV." };
  if (arquivo.size > 5 * 1024 * 1024) return { erro: "Arquivo maior que 5 MB." };
  const nome = txt(f, "nome") || arquivo.name.replace(/\.csv$/i, "");

  let tabela;
  try { tabela = parseCsv(await arquivo.text()); }
  catch (e) { return { erro: (e as Error).message }; }

  try {
    const [d] = await query<{ id: number }>(
      `INSERT INTO datasets (cliente_id, nome, colunas, linhas) VALUES ($1, $2, $3, $4) RETURNING id`,
      [clienteId, nome, JSON.stringify(tabela.colunas), JSON.stringify(tabela.linhas)]);
    await audit(admin.id, "dataset_criado", { dataset_id: d.id, cliente_id: clienteId, linhas: tabela.linhas.length });
  } catch (e) { return erroBanco(e); }
  revalidatePath(`/admin/clientes/${clienteId}`);
  return { ok: `Dataset "${nome}" importado: ${tabela.linhas.length} linhas, colunas ${tabela.colunas.join(", ")}.` };
}

export async function criarDashboard(_p: Resultado, f: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  const clienteId = int(f, "cliente_id");
  const nome = txt(f, "nome");
  const tipo = txt(f, "tipo") === "iframe" ? "iframe" : "interno";
  if (!nome) return { erro: "Informe o nome do dashboard." };

  let config: object;
  if (tipo === "iframe") {
    const url = txt(f, "url");
    if (!/^https:\/\//.test(url)) return { erro: "A URL precisa começar com https://" };
    config = { url };
  } else {
    const datasetId = int(f, "dataset_id");
    // o dataset tem que ser do mesmo cliente do dashboard
    const [ds] = await query<{ colunas: string[] }>(
      "SELECT colunas FROM datasets WHERE id = $1 AND cliente_id = $2", [datasetId, clienteId]);
    if (!ds) return { erro: "Escolha um dataset deste cliente." };
    const x = int(f, "x");
    const y = f.getAll("y").map((v) => Number(v)).filter((i) => i !== x && ds.colunas[i] !== undefined);
    if (ds.colunas[x] === undefined || y.length === 0) return { erro: "Escolha a coluna do eixo X e ao menos uma série Y." };
    config = { dataset_id: datasetId, grafico: txt(f, "grafico") === "barra" ? "barra" : "linha", x, y };
  }

  try {
    const [d] = await query<{ id: number }>(
      `INSERT INTO dashboards (cliente_id, nome, descricao, tipo, config) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [clienteId, nome, txt(f, "descricao") || null, tipo, JSON.stringify(config)]);
    await audit(admin.id, "dashboard_criado", { dashboard_id: d.id, cliente_id: clienteId, tipo });
  } catch (e) { return erroBanco(e); }
  revalidatePath(`/admin/clientes/${clienteId}`);
  return { ok: `Dashboard "${nome}" criado. Agora conceda o acesso aos usuários.` };
}

export async function excluirDashboard(_p: Resultado, f: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  const id = int(f, "dashboard_id");
  const [d] = await query<{ cliente_id: number; nome: string }>(
    "DELETE FROM dashboards WHERE id = $1 RETURNING cliente_id, nome", [id]);
  if (!d) return { erro: "Dashboard não encontrado." };
  await audit(admin.id, "dashboard_excluido", { dashboard_id: id, nome: d.nome });
  revalidatePath(`/admin/clientes/${d.cliente_id}`);
  return { ok: `Dashboard "${d.nome}" excluído (e os acessos a ele).` };
}

/* ── Acessos: o coração do portal ─────────────────────────────────────── */

export async function salvarAcessos(_p: Resultado, f: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  const usuarioId = int(f, "usuario_id");
  const marcados = [...new Set(f.getAll("dashboard_id").map(Number).filter(Number.isInteger))];

  const [u] = await query<{ cliente_id: number | null }>(
    "SELECT cliente_id FROM usuarios WHERE id = $1", [usuarioId]);
  if (!u?.cliente_id) return { erro: "Acessos só se aplicam a usuários de um cliente." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: antes } = await client.query<{ dashboard_id: number }>(
      "DELETE FROM acessos WHERE usuario_id = $1 RETURNING dashboard_id", [usuarioId]);
    if (marcados.length) {
      // as FKs compostas recusam dashboards de outro cliente
      await client.query(
        `INSERT INTO acessos (usuario_id, dashboard_id, cliente_id, concedido_por)
         SELECT $1, unnest($2::int[]), $3, $4`,
        [usuarioId, marcados, u.cliente_id, admin.id]);
    }
    await client.query("COMMIT");
    const anteriores = new Set(antes.map((r) => r.dashboard_id));
    await audit(admin.id, "acessos_alterados", {
      usuario_id: usuarioId,
      concedidos: marcados.filter((id) => !anteriores.has(id)),
      revogados: [...anteriores].filter((id) => !marcados.includes(id)),
    });
  } catch (e) {
    await client.query("ROLLBACK");
    return erroBanco(e);
  } finally {
    client.release();
  }
  revalidatePath(`/admin/clientes/${u.cliente_id}`);
  return { ok: `Acessos salvos: ${marcados.length} dashboard(s).` };
}
