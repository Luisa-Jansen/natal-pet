import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../../lib/http';
import { registrarHistorico } from '../../../lib/db';

export const prerender = false;

interface LinhaReserva {
  codigo: string;
  modalidade: string | null;
  status: string;
  comprovante_url: string | null;
  previsao_entrega: string | null;
  criado_em: string;
  animal_id: string;
  animal_nome: string;
  foto: string | null;
  cartinha: string | null;
  pedido: string | null;
  links_compra: string | null;
  padrinho_nome: string | null;
}

async function buscar(db: D1Database, codigo: string): Promise<LinhaReserva | null> {
  return (
    (await db
      .prepare(
        `SELECT r.codigo, r.modalidade, r.status, r.comprovante_url, r.previsao_entrega, r.criado_em,
                a.id AS animal_id, a.nome AS animal_nome, a.foto, a.cartinha, a.pedido, a.links_compra,
                p.nome AS padrinho_nome
         FROM reservas r
         JOIN animais a ON a.id = r.animal_id
         LEFT JOIN padrinhos p ON p.id = r.padrinho_id
         WHERE r.codigo = ?`
      )
      .bind(codigo)
      .first<LinhaReserva>()) ?? null
  );
}

// GET /api/reserva/NP2026-000042  -> dados para a tela de sucesso
export const GET: APIRoute = async ({ params }) => {
  const db = (env as any).DB as D1Database | undefined;
  if (!db) return json({ erro: 'Banco indisponível' }, 503);
  const codigo = String(params.codigo || '');
  const r = await buscar(db, codigo);
  if (!r) return json({ erro: 'Reserva não encontrada' }, 404);

  let links: Array<{ label: string; url: string }> = [];
  try {
    links = JSON.parse(r.links_compra || '[]');
  } catch {}

  return json({
    codigo: r.codigo,
    modalidade: r.modalidade,
    status: r.status,
    comprovante_url: r.comprovante_url,
    previsao_entrega: r.previsao_entrega,
    criado_em: r.criado_em,
    padrinho_nome: r.padrinho_nome,
    animal: {
      id: r.animal_id,
      nome: r.animal_nome,
      foto: r.foto,
      cartinha: r.cartinha,
      pedido: r.pedido,
      links_compra: links,
    },
  });
};

// POST /api/reserva/NP2026-000042  -> registra o compromisso da modalidade
// body: { acao: 'compromisso' | 'previsao', previsao_entrega?, observacao? }
// Move a reserva (e a cartinha) para 'aguardando_presente'.
export const POST: APIRoute = async ({ params, request }) => {
  const db = (env as any).DB as D1Database | undefined;
  if (!db) return json({ erro: 'Banco indisponível' }, 503);
  const codigo = String(params.codigo || '');

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {}
  const previsao = String(body.previsao_entrega ?? '').trim().slice(0, 40) || null;
  const observacao = String(body.observacao ?? '').trim().slice(0, 300) || null;

  const r = await buscar(db, codigo);
  if (!r) return json({ erro: 'Reserva não encontrada' }, 404);
  if (r.status === 'cancelada') return json({ erro: 'Esta reserva foi cancelada.' }, 409);

  // só avança quem ainda está no início do fluxo
  const novoStatus = r.status === 'reservada' ? 'aguardando_presente' : r.status;

  await db.batch([
    db
      .prepare(
        "UPDATE reservas SET status = ?, previsao_entrega = COALESCE(?, previsao_entrega), observacao = COALESCE(?, observacao), atualizado_em = datetime('now') WHERE codigo = ?"
      )
      .bind(novoStatus, previsao, observacao, codigo),
    db
      .prepare("UPDATE animais SET status = ?, atualizado_em = datetime('now') WHERE id = ?")
      .bind(novoStatus, r.animal_id),
  ]);

  await registrarHistorico(db, 'reserva', codigo, 'compromisso_registrado', `${r.animal_nome} · ${r.modalidade}`);
  return json({ ok: true, status: novoStatus });
};
