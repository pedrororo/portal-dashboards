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
- dashboard sem acesso responde 404 (não revela que existe);
- quem está com senha temporária só consegue acessar a tela de troca de senha.

### Login e senhas

- **Limite de tentativas:** 5 falhas por e-mail ou 20 por IP em 15 minutos bloqueiam novas tentativas
  (inclusive com a senha certa) até a janela passar. A contagem usa a tabela de auditoria, então vale
  com várias instâncias do servidor.
- **Senha temporária:** ao criar um usuário ou redefinir a senha, o portal gera uma senha temporária.
  Com SMTP configurado ela vai por e-mail; sem SMTP aparece uma vez na tela para o admin repassar.
- **Troca obrigatória:** no primeiro login com a senha temporária o usuário precisa escolher a própria senha.

### Tipos de dashboard

| Tipo | Como funciona | Segurança |
|---|---|---|
| `interno` | O portal desenha o gráfico (Chart.js) a partir de um dataset do cliente | Os dados só saem do servidor depois da checagem de acesso |
| `metabase` | Dashboard do Metabase com **embed assinado**: o servidor gera um link que expira em 10 min a cada visualização | Copiar o link não dá acesso permanente; com “parâmetro de cliente” o filtro fica travado no cliente do usuário |
| `iframe` | Incorpora uma URL externa (Looker Studio, Grafana…) | O portal controla quem vê o link; se a URL for pública, qualquer um com o link vê |

Com o parâmetro de cliente, **um único dashboard do Metabase serve todos os clientes**: o portal envia
`{"cliente": "<slug do cliente>"}` travado no token, e cada usuário só enxerga os dados do próprio cliente.
No Metabase: ative o embed do dashboard e marque o parâmetro como *Locked*. Testado com o Metabase v0.65.3:
o mesmo dashboard mostra só os dados de cada cliente, um token sem o cliente é recusado e tentar trocar o
cliente pela URL do embed devolve erro 400.

Para crescer depois (ex.: Power BI Embedded), basta um novo `tipo` que gere a URL/token **no servidor**
depois da checagem de acesso, como o `metabase` faz em `src/lib/metabase.ts` — o modelo de acessos não muda.

## Rodando localmente

Requer Node.js 20+ e Docker.

```bash
npm install
cp .env.example .env        # ajuste SESSION_SECRET, ADMIN_EMAIL e ADMIN_PASSWORD
npm run db:up               # Postgres em localhost:5433 (docker compose)
npm run db:setup            # aplica as migrations de db/migrations (pode rodar sempre)
npm run db:seed             # admin + 2 clientes de demonstração (preços sintéticos)
npm run dev                 # http://localhost:3000
```

O seed imprime as senhas dos usuários de demonstração. Cada usuário pode trocar a senha em **Minha conta**.

Para mudar o banco, crie um novo arquivo numerado em `db/migrations/` (ex.: `003_....sql`); o `db:setup`
aplica só as que ainda não rodaram.

## Rodando tudo com Docker

O mesmo `docker-compose.yml` sobe o banco, as migrations, o portal e (opcional) o Metabase:

```bash
cp .env.example .env                                   # SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD...
docker compose --profile app up -d --build             # Postgres + migrations + portal em http://localhost:3000
docker compose --profile app run --rm migrate npx tsx scripts/seed.ts   # dados de demonstração (1ª vez)
docker compose --profile metabase up -d                # Metabase em http://localhost:3001 (opcional)
```

- Dentro do Docker o portal usa o banco `db:5432`; o `DATABASE_URL` do `.env` vale só para rodar fora do Docker.
- `docker compose up -d db` continua subindo só o Postgres para o `npm run dev`.
- A imagem do portal (`Dockerfile`, etapa `app`) tem só o servidor compilado, roda sem root e tem healthcheck.
  A etapa `ferramentas` tem o código completo e é usada para migrations e seed.
- O Metabase guarda a própria configuração (H2) no volume `metabase-data`. Para produção, use Postgres
  (`MB_DB_TYPE=postgres` e `MB_DB_*`).

## Testes

```bash
npm test                                  # unidade + regras no banco (cria/recria o banco portal_test)
BASE_URL=http://localhost:3000 npm run test:e2e   # matriz de acesso via HTTP contra o servidor rodando
```

- `tests/unit.test.ts`: CSV, senhas temporárias, token de sessão, assinatura do Metabase
- `tests/db.test.ts`: restrições entre clientes, quem vê qual dashboard, limite de login
- `tests/e2e/acesso-http.ts`: cada usuário x cada dashboard e página de admin, usuário desativado e senha temporária

No GitHub, `.github/workflows/ci.yml` roda tipos e testes a cada push/PR (com um Postgres de serviço) e, na `main`,
publica a imagem do portal em `ghcr.io/pedrororo/portal-dashboards` com as tags `<commit>` e `latest`.

## Fluxo do admin

1. **Clientes → Novo cliente**
2. No cliente: **Criar usuário** (a senha temporária vai por e-mail; sem SMTP aparece uma vez na tela)
3. **Importar CSV** (cabeçalho na 1ª linha; separador `;` ou `,`)
4. **Criar dashboard** a partir do dataset, de um dashboard do Metabase ou de uma URL externa
5. No usuário: **definir acessos** → marcar os dashboards → **Salvar acessos**

Tudo fica registrado em **Auditoria**.

## Estrutura

```
db/migrations/                        tabelas e restrições (aplicadas em ordem)
Dockerfile, docker-compose.yml        imagem do portal e a pilha completa
.github/workflows/ci.yml              testes + publicação da imagem no GHCR
scripts/db-setup.ts, seed.ts          criação e dados de demonstração
src/middleware.ts                     bloqueia páginas sem sessão
src/lib/
  session.ts                          token de sessão (JWT em cookie httpOnly)
  auth.ts                             usuário atual, requireUser / requireAdmin
  acesso.ts                           a regra "quem vê qual dashboard"
  limite.ts                           limite de tentativas de login
  email.ts                            envio da senha temporária (SMTP)
  metabase.ts                         embed assinado do Metabase
  db.ts, csv.ts, senha.ts
src/app/
  login/                              login (com limite) e logout
  trocar-senha/                       troca obrigatória da senha temporária
  (app)/dashboards/                   lista e visualização
  (app)/admin/                        clientes, usuários, dados, dashboards, acessos, auditoria
  (app)/conta/                        trocar a própria senha
```

## Próximos passos sugeridos

- Tipo `powerbi` com embed token (Power BI Embedded), no mesmo molde do `metabase`
- Admin poder desbloquear um login antes da janela de 15 minutos
- Publicar em um servidor (VPS com Docker Compose ou Render) usando a imagem do GHCR
