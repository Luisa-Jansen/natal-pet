-- ============================================================================
--  Banco de dados da campanha "Adote uma Carta de Natal PET"
--  Cloudflare D1 (SQLite). Script idempotente: pode rodar várias vezes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ANIMAIS  (as cartinhas)
--   status: disponivel | reservada | aguardando_presente | presente_recebido | concluida
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS animais (
  id            TEXT PRIMARY KEY,              -- slug: "afonso", "aipim"...
  nome          TEXT NOT NULL,
  especie       TEXT NOT NULL DEFAULT 'indefinido',  -- cachorro | gato | indefinido
  historia      TEXT,
  pedido        TEXT,
  cartinha      TEXT,
  foto          TEXT,                          -- "/pets/x.png" ou "/uploads/<chave>"
  foto_posicao  TEXT DEFAULT '50% 42%',        -- object-position da foto (enquadramento)
  categoria     TEXT DEFAULT 'outros',         -- cama|conforto|brinquedo|petisco|outros
  links_compra  TEXT DEFAULT '[]',             -- JSON: [{"label":"...","url":"..."}]
  ativo         INTEGER NOT NULL DEFAULT 1,     -- 0/1 (cartinha ativa na vitrine)
  status        TEXT NOT NULL DEFAULT 'disponivel',
  ordem         INTEGER NOT NULL DEFAULT 0,
  criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_animais_status  ON animais (status);
CREATE INDEX IF NOT EXISTS idx_animais_especie ON animais (especie);

-- ----------------------------------------------------------------------------
-- PADRINHOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS padrinhos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL,
  whatsapp   TEXT,
  email      TEXT,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_padrinhos_email ON padrinhos (email);

-- ----------------------------------------------------------------------------
-- RESERVAS  (o apadrinhamento de uma cartinha)
--   modalidade: pix | compra_online | entrega_presencial
--   status: reservada | aguardando_presente | presente_recebido | concluida | cancelada
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo           TEXT NOT NULL UNIQUE,       -- "NP2026-000042"
  animal_id        TEXT NOT NULL REFERENCES animais(id),
  padrinho_id      INTEGER REFERENCES padrinhos(id),
  modalidade       TEXT,
  status           TEXT NOT NULL DEFAULT 'reservada',
  comprovante_url  TEXT,
  observacao       TEXT,
  previsao_entrega TEXT,
  criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em    TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Impede que a MESMA cartinha tenha duas reservas ativas ao mesmo tempo.
-- (uma reserva "cancelada" libera a cartinha novamente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reserva_ativa
  ON reservas (animal_id) WHERE status <> 'cancelada';
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas (status);
CREATE INDEX IF NOT EXISTS idx_reservas_data   ON reservas (criado_em);

-- ----------------------------------------------------------------------------
-- CONFIG  (chave/valor: textos da campanha, PIX, endereço, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config (
  chave         TEXT PRIMARY KEY,
  valor         TEXT,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- USUARIOS_ADMIN  (acesso ao painel; senha com PBKDF2 / WebCrypto)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_admin (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE,
  nome        TEXT,
  senha_hash  TEXT NOT NULL,
  senha_salt  TEXT NOT NULL,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- SESSOES  (sessão de admin em banco: token aleatório no cookie)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessoes (
  id          TEXT PRIMARY KEY,               -- token aleatório
  usuario_id  INTEGER NOT NULL REFERENCES usuarios_admin(id),
  expira_em   TEXT NOT NULL,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes (usuario_id);

-- ----------------------------------------------------------------------------
-- HISTORICO  (auditoria de alterações)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historico (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entidade    TEXT,                            -- animal | reserva | config
  entidade_id TEXT,
  acao        TEXT,
  detalhe     TEXT,
  usuario     TEXT,                            -- email do admin ou "sistema"
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_historico_entidade ON historico (entidade, entidade_id);

-- ----------------------------------------------------------------------------
-- ADOCOES  (tabela ANTIGA — preservada para a migração não perder dados).
--   O seed migra estas linhas para padrinhos + reservas.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adocoes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id           TEXT    NOT NULL UNIQUE,
  pet_nome         TEXT    NOT NULL,
  pedido           TEXT,
  padrinho_nome    TEXT    NOT NULL,
  padrinho_contato TEXT,
  padrinho_cidade  TEXT,
  criado_em        TEXT    NOT NULL DEFAULT (datetime('now'))
);
