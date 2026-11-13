// ============================================================================
//  Gera db/seed.sql a partir de src/data/pets.json.
//  Conteúdo gerado:
//   - os 83 animais (INSERT OR IGNORE: não sobrescreve edições feitas no painel)
//   - configurações padrão da campanha (ano 2026, PIX, endereço...)
//   - 1 usuário administrador (senha com PBKDF2, compatível com o WebCrypto do Worker)
//   - migração das adoções antigas (tabela `adocoes`) -> padrinhos + reservas
//
//  Uso:   node db/seed.mjs          (gera db/seed.sql)
//  Depois: wrangler d1 execute natal_pet_db --local  --file=./db/seed.sql
//          wrangler d1 execute natal_pet_db --remote --file=./db/seed.sql
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { categorizar } from '../src/lib/categorias.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raiz = join(__dirname, '..');

// ---- parâmetros do admin (podem vir do ambiente) --------------------------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@natalpet.com.br';
const ADMIN_NOME = process.env.ADMIN_NOME || 'Administração';
const ADMIN_SENHA = process.env.ADMIN_SENHA || 'natal2026';

// PBKDF2-HMAC-SHA256, 100k iterações, 32 bytes -> hex. Igual ao verificador do Worker.
export const PBKDF2_ITER = 100000;
function hashSenha(senha, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return pbkdf2Sync(senha, salt, PBKDF2_ITER, 32, 'sha256').toString('hex');
}

// ---- helpers de SQL --------------------------------------------------------
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

// ---- lê os pets ------------------------------------------------------------
const dados = JSON.parse(readFileSync(join(raiz, 'src/data/pets.json'), 'utf8'));
const pets = dados.pets;

const linhas = [];
linhas.push('-- GERADO POR db/seed.mjs — NÃO EDITE À MÃO (rode `node db/seed.mjs`).');
linhas.push('-- Idempotente: pode ser aplicado várias vezes sem duplicar dados.');
linhas.push('');

// ---- animais ---------------------------------------------------------------
linhas.push('-- ===== ANIMAIS (as 83 cartinhas) =====');
pets.forEach((p, i) => {
  const categoria = categorizar(p.pedido || '');
  linhas.push(
    `INSERT OR IGNORE INTO animais (id, nome, especie, historia, pedido, cartinha, foto, categoria, links_compra, ativo, status, ordem) VALUES (` +
      `${q(p.id)}, ${q(p.nome)}, ${q(p.especie || 'indefinido')}, ${q(p.historia)}, ${q(p.pedido)}, ` +
      `${q(p.cartinha)}, ${q(p.foto)}, ${q(categoria)}, '[]', 1, 'disponivel', ${i});`
  );
});
linhas.push('');

// ---- configurações padrão --------------------------------------------------
const config = {
  campanha_nome: 'Adote uma Carta de Natal',
  campanha_marca: 'Shopping Cerrado',
  campanha_slogan: 'Viva o Jeito Goiano',
  campanha_descricao:
    'Neste Natal, realize o desejo de um pet de abrigo. Escolha uma cartinha, presenteie e leve alegria para quem só quer um lar.',
  campanha_ano: '2026',
  pix_chave: '',
  pix_qr_url: '',
  endereco_entrega: '',
  orientacoes_entrega:
    'Leve o presente até o abrigo no horário combinado. Em caso de dúvida, fale com a gente pelo WhatsApp.',
  telefones: JSON.stringify(['556283434199', '556295708383']),
};
linhas.push('-- ===== CONFIGURAÇÕES DA CAMPANHA =====');
for (const [chave, valor] of Object.entries(config)) {
  linhas.push(`INSERT OR IGNORE INTO config (chave, valor) VALUES (${q(chave)}, ${q(valor)});`);
}
linhas.push('');

// ---- usuário admin ---------------------------------------------------------
const saltHex = randomBytes(16).toString('hex');
const hashHex = hashSenha(ADMIN_SENHA, saltHex);
linhas.push('-- ===== USUÁRIO ADMINISTRADOR =====');
linhas.push(`-- login: ${ADMIN_EMAIL}   |   senha inicial: ${ADMIN_SENHA}   (troque no painel!)`);
linhas.push(
  `INSERT OR IGNORE INTO usuarios_admin (email, nome, senha_hash, senha_salt) VALUES (` +
    `${q(ADMIN_EMAIL)}, ${q(ADMIN_NOME)}, ${q(hashHex)}, ${q(saltHex)});`
);
linhas.push('');

// ---- migração das adoções antigas -----------------------------------------
// Tudo com guardas (NOT EXISTS) para ser seguro em reexecuções.
linhas.push('-- ===== MIGRAÇÃO: adocoes antigas -> padrinhos + reservas =====');
linhas.push(`-- 1) cria um padrinho por adoção (id determinístico = 100000 + adocoes.id)`);
linhas.push(
  `INSERT OR IGNORE INTO padrinhos (id, nome, whatsapp, email, criado_em)\n` +
    `SELECT 100000 + a.id, a.padrinho_nome, a.padrinho_contato, NULL, a.criado_em\n` +
    `FROM adocoes a\n` +
    `WHERE EXISTS (SELECT 1 FROM animais an WHERE an.id = a.pet_id)\n` +
    `  AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.animal_id = a.pet_id AND r.status <> 'cancelada');`
);
linhas.push('');
linhas.push(`-- 2) cria a reserva ligada ao padrinho acima (status 'reservada')`);
linhas.push(
  `INSERT OR IGNORE INTO reservas (codigo, animal_id, padrinho_id, modalidade, status, criado_em, atualizado_em)\n` +
    `SELECT printf('NP-MIG-%06d', a.id), a.pet_id, 100000 + a.id, NULL, 'reservada', a.criado_em, a.criado_em\n` +
    `FROM adocoes a\n` +
    `WHERE EXISTS (SELECT 1 FROM animais an WHERE an.id = a.pet_id)\n` +
    `  AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.animal_id = a.pet_id AND r.status <> 'cancelada');`
);
linhas.push('');
linhas.push(`-- 3) marca como 'reservada' todo animal que tenha reserva ativa`);
linhas.push(
  `UPDATE animais SET status = 'reservada', atualizado_em = datetime('now')\n` +
    `WHERE status = 'disponivel'\n` +
    `  AND id IN (SELECT animal_id FROM reservas WHERE status <> 'cancelada');`
);
linhas.push('');

writeFileSync(join(__dirname, 'seed.sql'), linhas.join('\n'), 'utf8');
console.log(`db/seed.sql gerado: ${pets.length} animais, ${Object.keys(config).length} configs, 1 admin (${ADMIN_EMAIL}).`);
