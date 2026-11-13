// ============================================================================
//  Acesso ao banco (Cloudflare D1) — funções compartilhadas pela home,
//  pelas APIs públicas e pelo painel administrativo.
// ============================================================================
import type { D1Database } from '@cloudflare/workers-types';

// ---- Status das cartinhas --------------------------------------------------
export const STATUS = {
  disponivel: 'disponivel',
  reservada: 'reservada',
  aguardando_presente: 'aguardando_presente',
  presente_recebido: 'presente_recebido',
  concluida: 'concluida',
  cancelada: 'cancelada',
} as const;
export type Status = keyof typeof STATUS;

export const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível',
  reservada: 'Reservada',
  aguardando_presente: 'Aguardando presente',
  presente_recebido: 'Presente recebido',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const MODALIDADE_LABEL: Record<string, string> = {
  pix: 'PIX',
  compra_online: 'Compra online',
  entrega_presencial: 'Entrega presencial',
};

// ---- Tipos -----------------------------------------------------------------
export interface Animal {
  id: string;
  nome: string;
  especie: string;
  historia: string | null;
  pedido: string | null;
  cartinha: string | null;
  foto: string | null;
  foto_posicao?: string | null;
  categoria: string;
  links_compra: string; // JSON string
  ativo: number;
  status: string;
  ordem: number;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ContagemStatus {
  total: number;
  disponivel: number;
  reservada: number;
  aguardando_presente: number;
  presente_recebido: number;
  concluida: number;
}

// ---- Config (chave/valor) --------------------------------------------------
export async function carregarConfig(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db
    .prepare('SELECT chave, valor FROM config')
    .all<{ chave: string; valor: string }>();
  const mapa: Record<string, string> = {};
  for (const r of results ?? []) mapa[r.chave] = r.valor ?? '';
  return mapa;
}

export async function salvarConfig(db: D1Database, chave: string, valor: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO config (chave, valor, atualizado_em) VALUES (?, ?, datetime('now'))
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = datetime('now')`
    )
    .bind(chave, valor)
    .run();
}

// ---- Animais ---------------------------------------------------------------
/** Lista animais. Por padrão só os ativos (para a vitrine pública). */
export async function listarAnimais(
  db: D1Database,
  opts: { apenasAtivos?: boolean } = {}
): Promise<Animal[]> {
  const where = opts.apenasAtivos ? 'WHERE ativo = 1' : '';
  const { results } = await db
    .prepare(`SELECT * FROM animais ${where} ORDER BY ordem, nome`)
    .all<Animal>();
  return results ?? [];
}

export async function obterAnimal(db: D1Database, id: string): Promise<Animal | null> {
  return (await db.prepare('SELECT * FROM animais WHERE id = ?').bind(id).first<Animal>()) ?? null;
}

/** Contagens reais por status (só cartinhas ativas). */
export async function contarPorStatus(db: D1Database): Promise<ContagemStatus> {
  const { results } = await db
    .prepare('SELECT status, COUNT(*) AS n FROM animais WHERE ativo = 1 GROUP BY status')
    .all<{ status: string; n: number }>();
  const c: ContagemStatus = {
    total: 0,
    disponivel: 0,
    reservada: 0,
    aguardando_presente: 0,
    presente_recebido: 0,
    concluida: 0,
  };
  for (const r of results ?? []) {
    c.total += r.n;
    if (r.status in c) (c as Record<string, number>)[r.status] = r.n;
  }
  return c;
}

/** Ids das cartinhas que NÃO estão disponíveis (para a galeria marcar). */
export async function idsIndisponiveis(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT id FROM animais WHERE ativo = 1 AND status <> 'disponivel'")
    .all<{ id: string }>();
  return (results ?? []).map((r) => r.id);
}

// ---- Histórico (auditoria) -------------------------------------------------
export async function registrarHistorico(
  db: D1Database,
  entidade: string,
  entidadeId: string,
  acao: string,
  detalhe = '',
  usuario = 'sistema'
): Promise<void> {
  try {
    await db
      .prepare(
        'INSERT INTO historico (entidade, entidade_id, acao, detalhe, usuario) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(entidade, entidadeId, acao, detalhe, usuario)
      .run();
  } catch {
    /* histórico é best-effort: nunca quebra a operação principal */
  }
}

// ---- Senhas (PBKDF2 via WebCrypto — compatível com db/seed.mjs) ------------
export const PBKDF2_ITER = 100000;

function hexParaBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}
function bytesParaHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function derivarHash(senha: string, saltHex: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(senha),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexParaBytes(saltHex), iterations: PBKDF2_ITER, hash: 'SHA-256' },
    chave,
    256
  );
  return bytesParaHex(bits);
}

export async function gerarHashSenha(senha: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesParaHex(salt.buffer);
  return { hash: await derivarHash(senha, saltHex), salt: saltHex };
}

export async function verificarSenha(
  senha: string,
  hashHex: string,
  saltHex: string
): Promise<boolean> {
  const calc = await derivarHash(senha, saltHex);
  // comparação de tempo constante
  if (calc.length !== hashHex.length) return false;
  let dif = 0;
  for (let i = 0; i < calc.length; i++) dif |= calc.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return dif === 0;
}

// ---- Código de reserva -----------------------------------------------------
/** Gera "NP2026-000042" a partir do id numérico da reserva. */
export function codigoReserva(ano: string | number, seq: number): string {
  return `NP${ano}-${String(seq).padStart(6, '0')}`;
}
