# portal-dashboards

Portal de dashboards por cliente. Cada cliente entra e vê **só** os dashboards que o administrador liberou para ele.

- **Admin** (equipe): cadastra clientes, usuários, dados e dashboards, e é o **único** que concede acesso.
- **Viewer** (usuário do cliente): vê apenas o que foi concedido a ele.

## Como funciona

```
clientes ──< usuarios          (viewer pertence a um cliente; admin não)
clientes ──< datasets          (dados do cliente, ex.: CSV importado)
clientes ──< dashboards        (gráfico do portal ou página externa)
usuarios >──< dashboards  via  acessos   (as concessões feitas pelo admin)
auditoria                      (login, acessos concedidos/revogados, dashboards abertos)
```

Regras garantidas pelo **banco** (não só pelo código):

- um acesso só pode ligar usuário e dashboard **do mesmo cliente** (FKs compostas em `acessos`);
- viewer sempre tem cliente; admin nunca tem.

Regras garantidas pelo servidor em toda requisição:

- sem sessão válida, nada além do login abre;
- a sessão é conferida no banco: usuário ou cliente desativado perde o acesso na hora;
- toda operação de admin começa com `requireAdmin()`;
- dashboard sem acesso responde 404 (não revela que existe).

### Tipos de dashboard

| Tipo | Como funciona | Segurança |
|---|---|---|
| `interno` | O portal desenha o gráfico (Chart.js) a partir de um dataset do cliente | Os dados só saem do servidor depois da checagem de acesso |
| `iframe` | Incorpora uma URL externa (Metabase, Looker Studio, Grafana…) | O portal controla quem vê o link; se a URL for pública, qualquer um com o link vê |

Para crescer depois (ex.: Power BI Embedded, Metabase com embed assinado), basta um novo `tipo` que gere a URL/token **no servidor** depois da checagem de acesso — o modelo de acessos não muda.

## Rodando localmente

Requer Node.js 20+ e Docker.

```bash
npm install
cp .env.example .env        # ajuste SESSION_SECRET, ADMIN_EMAIL e ADMIN_PASSWORD
npm run db:up               # Postgres em localhost:5433 (docker compose)
npm run db:setup            # cria as tabelas
npm run db:seed             # admin + 2 clientes de demonstração (dados públicos do Cepea)
npm run dev                 # http://localhost:3000
```

O seed imprime as senhas temporárias dos usuários de demonstração. Cada usuário pode trocar a senha em **Minha conta**.

## Fluxo do admin

1. **Clientes → Novo cliente**
2. No cliente: **Criar usuário** (a senha temporária aparece uma vez, para repassar ao usuário)
3. **Importar CSV** (cabeçalho na 1ª linha; separador `;` ou `,`)
4. **Criar dashboard** a partir do dataset (ou de uma URL externa)
5. No usuário: **definir acessos** → marcar os dashboards → **Salvar acessos**

Tudo fica registrado em **Auditoria**.

## Estrutura

```
db/schema.sql                         tabelas e restrições
scripts/db-setup.ts, seed.ts          criação e dados de demonstração
src/middleware.ts                     bloqueia páginas sem sessão
src/lib/
  session.ts                          token de sessão (JWT em cookie httpOnly)
  auth.ts                             usuário atual, requireUser / requireAdmin
  acesso.ts                           a regra "quem vê qual dashboard"
  db.ts, csv.ts, senha.ts
src/app/
  login/                              login e logout
  (app)/dashboards/                   lista e visualização
  (app)/admin/                        clientes, usuários, dados, dashboards, acessos, auditoria
  (app)/conta/                        trocar a própria senha
```

## Próximos passos sugeridos

- Limite de tentativas de login (rate limit)
- Envio da senha temporária por e-mail e troca obrigatória no 1º acesso
- Novo tipo de dashboard com embed assinado (Metabase / Power BI Embedded)
- Testes automatizados das regras de acesso
