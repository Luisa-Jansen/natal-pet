-- Tabela de adoções de cartinhas.
-- pet_id é UNIQUE: garante que cada cartinha só pode ser adotada uma vez.
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

CREATE INDEX IF NOT EXISTS idx_adocoes_pet ON adocoes (pet_id);
CREATE INDEX IF NOT EXISTS idx_adocoes_data ON adocoes (criado_em);
