// Matriz de acesso via HTTP contra um servidor rodando (npm run dev / start) e o banco dele.
// Para cada usuário x dashboard confere o status esperado a partir da tabela "acessos".
// Uso: BASE_URL=http://localhost:3000 npm run test:e2e
import { SignJWT } from "jose";
import { Pool } from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const chave = new TextEncoder().encode(process.env.SESSION_SECRET);
let falhas = 0;

const token = (id: number) =>
  new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(String(id)).setIssuedAt().setExpirationTime("5m").sign(chave);

async function status(path: string, t?: string) {
  const r = await fetch(BASE + path, { redirect: "manual", headers: t ? { cookie: `sessao=${t}` } : {} });
  const destino = r.headers.get("location");
  return destino ? `${r.status}→${new URL(destino, BASE).pathname}` : String(r.status);
}

function conferir(rotulo: string, obtido: string, esperado: string) {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${rotulo}: ${obtido}${ok ? "" : ` (esperado ${esperado})`}`);
}

async function main() {
  conferir("sem sessão /dashboards", await status("/dashboards"), "307→/login");
  conferir("sem sessão /admin", await status("/admin"), "307→/login");
  conferir("token forjado /admin", await status("/admin", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.x"), "307→/login");

  const usuarios = (await pool.query("SELECT id, email, papel FROM usuarios WHERE ativo AND NOT trocar_senha ORDER BY id")).rows;
  const dashboards = (await pool.query("SELECT id FROM dashboards ORDER BY id")).rows;
  const concedidos = new Set(
    (await pool.query("SELECT usuario_id || '-' || dashboard_id AS k FROM acessos")).rows.map((r) => r.k));

  for (const u of usuarios) {
    const t = await token(u.id);
    for (const d of dashboards) {
      const pode = u.papel === "admin" || concedidos.has(`${u.id}-${d.id}`);
      conferir(`${u.email} → dashboard ${d.id}`, await status(`/dashboards/${d.id}`, t), pode ? "200" : "404");
    }
    conferir(`${u.email} → /admin`, await status("/admin", t), u.papel === "admin" ? "200" : "307→/dashboards");
  }

  // usuário desativado e usuário com senha temporária, com token válido
  const viewer = usuarios.find((u) => u.papel === "viewer");
  if (viewer) {
    const t = await token(viewer.id);
    try {
      await pool.query("UPDATE usuarios SET ativo = false WHERE id = $1", [viewer.id]);
      conferir("usuário desativado → /dashboards", await status("/dashboards", t), "307→/login");
      await pool.query("UPDATE usuarios SET ativo = true, trocar_senha = true WHERE id = $1", [viewer.id]);
      conferir("senha temporária → /dashboards", await status("/dashboards", t), "307→/trocar-senha");
      conferir("senha temporária → /trocar-senha", await status("/trocar-senha", t), "200");
    } finally {
      await pool.query("UPDATE usuarios SET ativo = true, trocar_senha = false WHERE id = $1", [viewer.id]);
    }
  }

  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodas as verificações passaram.");
  process.exitCode = falhas ? 1 : 0;
}

main().finally(() => pool.end());
