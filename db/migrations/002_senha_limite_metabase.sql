-- 002: troca obrigatória de senha, índice para limite de login e tipo de dashboard "metabase"

-- true quando a senha foi gerada pelo admin (criação ou redefinição):
-- o usuário precisa trocá-la antes de usar o portal
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS trocar_senha boolean NOT NULL DEFAULT false;

-- o limite de tentativas conta os "login_falhou" recentes por e-mail e por IP
CREATE INDEX IF NOT EXISTS auditoria_acao_em_idx ON auditoria (acao, em DESC);

-- tipo 'metabase': dashboard do Metabase com embed assinado
--   config = {"dashboard": 12}  (o token é gerado no servidor a cada visualização)
ALTER TABLE dashboards DROP CONSTRAINT IF EXISTS dashboards_tipo_check;
ALTER TABLE dashboards ADD CONSTRAINT dashboards_tipo_check CHECK (tipo IN ('interno', 'iframe', 'metabase'));
