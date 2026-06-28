-- ============================================================
--  MÖRK BORG COMPANION — Supabase Setup SQL
--  Execute este arquivo no SQL Editor do Supabase
--  Acesse: seu projeto → SQL Editor → New Query → cole e Run
-- ============================================================


-- ── 1. TABELA DE PERSONAGENS ──────────────────────────────────
-- Guarda todos os dados da ficha em um campo JSONB (flexível)
-- Campos separados (nome, classe) permitem listagem rápida

CREATE TABLE IF NOT EXISTS personagens (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  char_id     TEXT        NOT NULL,                  -- ID gerado pelo frontend
  nome        TEXT        NOT NULL DEFAULT '',
  classe      TEXT        NOT NULL DEFAULT '',
  dados       JSONB       NOT NULL DEFAULT '{}',     -- Todos os dados da ficha
  retrato_url TEXT,                                  -- URL pública do Storage
  modificado  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Um usuário não pode ter dois personagens com o mesmo char_id
  UNIQUE(user_id, char_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_personagens_user_id   ON personagens(user_id);
CREATE INDEX IF NOT EXISTS idx_personagens_modificado ON personagens(modificado DESC);


-- ── 2. ROW LEVEL SECURITY (RLS) ───────────────────────────────
-- Cada usuário só vê e edita os PRÓPRIOS personagens
-- Isso é feito no banco de dados — mesmo que alguém tente
-- burlar o frontend, o banco bloqueia o acesso.

ALTER TABLE personagens ENABLE ROW LEVEL SECURITY;

-- Política: usuário só acessa suas próprias linhas
CREATE POLICY "usuarios_veem_seus_personagens"
  ON personagens
  FOR ALL                               -- SELECT, INSERT, UPDATE, DELETE
  USING      (auth.uid() = user_id)    -- condição de leitura
  WITH CHECK (auth.uid() = user_id);   -- condição de escrita


-- ── 3. BUCKET DE STORAGE (Retratos) ──────────────────────────
-- Cria o bucket para imagens de retrato dos personagens

INSERT INTO storage.buckets (id, name, public)
VALUES ('retratos', 'retratos', true)  -- public = true → URLs públicas
ON CONFLICT (id) DO NOTHING;

-- Política: qualquer um pode VER as imagens (bucket público)
CREATE POLICY "retratos_publicos_para_leitura"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'retratos');

-- Política: usuário só faz upload na PRÓPRIA pasta (user_id/...)
CREATE POLICY "usuarios_fazem_upload_proprios_retratos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'retratos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política: usuário pode atualizar/deletar só seus próprios arquivos
CREATE POLICY "usuarios_gerenciam_proprios_retratos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'retratos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "usuarios_deletam_proprios_retratos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'retratos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ── 4. VERIFICAÇÃO ────────────────────────────────────────────
-- Rode esta query para confirmar que tudo foi criado:

SELECT
  'Tabela personagens criada'  AS status WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'personagens')
UNION ALL
SELECT
  'RLS ativado'               AS status WHERE EXISTS (SELECT 1 FROM pg_tables WHERE tablename='personagens' AND rowsecurity=true)
UNION ALL
SELECT
  'Bucket retratos criado'    AS status WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id='retratos');
