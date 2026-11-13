import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../../lib/http';
import { salvarConfig, registrarHistorico } from '../../../lib/db';

export const prerender = false;

// chaves de config que o painel pode gravar
const CHAVES = [
  'campanha_nome',
  'campanha_marca',
  'campanha_slogan',
  'campanha_descricao',
  'campanha_ano',
  'pix_chave',
  'pix_qr_url',
  'endereco_entrega',
  'orientacoes_entrega',
];

// POST /api/admin/config  body: { campanha_ano, pix_chave, ..., telefones: [] }
export const POST: APIRoute = async ({ request, locals }) => {
  const db = (env as any).DB as D1Database | undefined;
  if (!db) return json({ erro: 'Banco indisponível' }, 503);

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return json({ erro: 'Requisição inválida' }, 400);
  }

  for (const chave of CHAVES) {
    if (chave in b) await salvarConfig(db, chave, String(b[chave] ?? '').slice(0, 2000));
  }
  if (Array.isArray(b.telefones)) {
    const tels = (b.telefones as unknown[]).map((t) => String(t).replace(/\D/g, '')).filter(Boolean);
    await salvarConfig(db, 'telefones', JSON.stringify(tels));
  }

  await registrarHistorico(db, 'config', 'campanha', 'config_atualizada', '', locals.admin?.email || 'admin');
  return json({ ok: true });
};
