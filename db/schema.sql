-- Portal de dashboards por cliente
-- Regra central: um usuário "viewer" só vê os dashboards que um admin concedeu a ele,
-- e só podem ser concedidos dashboards do mesmo cliente do usuário (garantido por FK).

CREATE TABLE IF NOT EXISTS clientes (
  id         serial PRIMARY KEY,
  nome       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id          serial PRIMARY KEY,
  cliente_id  int REFERENCES clientes(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  email       text NOT NULL UNIQUE,
  senha_hash  text NOT NULL,
  papel       text NOT NULL CHECK (papel IN ('admin', 'viewer')),
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  -- admin é da equipe (sem cliente); viewer sempre pertence a um cliente
  CHECK ((papel = 'admin' AND cliente_id IS NULL) OR (papel = 'viewer' AND cliente_id IS NOT NULL)),
  UNIQUE (id, cliente_id)
);

-- Dados brutos de um cliente (ex.: CSV enviado pelo admin), usados por dashboards "interno"
CREATE TABLE IF NOT EXISTS datasets (
  id          serial PRIMARY KEY,
  cliente_id  int NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  colunas     jsonb NOT NULL,          -- ["Data", "Preço"]
  linhas      jsonb NOT NULL,          -- [["02/01/2015", 2.69], ...]
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, cliente_id)
);

-- tipo 'interno': gráfico desenhado pelo portal a partir de um dataset do mesmo cliente
--   config = {"dataset_id": 1, "grafico": "linha", "x": 0, "y": [1]}
-- tipo 'iframe': incorpora uma URL externa (Metabase, Looker Studio...)
--   config = {"url": "https://..."}
-- Futuro: 'powerbi' com embed token gerado no servidor.
CREATE TABLE IF NOT EXISTS dashboards (
  id          serial PRIMARY KEY,
  cliente_id  int NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  descricao   text,
  tipo        text NOT NULL CHECK (tipo IN ('interno', 'iframe')),
  config      jsonb NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, cliente_id)
);

-- As concessões. cliente_id aparece nas duas FKs compostas, então o banco recusa
-- qualquer acesso de um usuário a dashboard de outro cliente.
CREATE TABLE IF NOT EXISTS acessos (
  usuario_id     int NOT NULL,
  dashboard_id   int NOT NULL,
  cliente_id     int NOT NULL,
  concedido_por  int REFERENCES usuarios(id) ON DELETE SET NULL,
  concedido_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, dashboard_id),
  FOREIGN KEY (usuario_id, cliente_id)   REFERENCES usuarios(id, cliente_id)   ON DELETE CASCADE,
  FOREIGN KEY (dashboard_id, cliente_id) REFERENCES dashboards(id, cliente_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auditoria (
  id          bigserial PRIMARY KEY,
  usuario_id  int REFERENCES usuarios(id) ON DELETE SET NULL,
  acao        text NOT NULL,           -- login, acesso_concedido, dashboard_aberto...
  detalhe     jsonb,
  em          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_em_idx ON auditoria (em DESC);
CREATE INDEX IF NOT EXISTS dashboards_cliente_idx ON dashboards (cliente_id);
CREATE INDEX IF NOT EXISTS usuarios_cliente_idx ON usuarios (cliente_id);
