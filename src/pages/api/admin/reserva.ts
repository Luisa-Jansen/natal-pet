import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../../lib/http';
import { registrarHistorico } from '../../../lib/db';

export const prerender = false;

// Ação -> novo status da reserva e do animal
const TRANSICOES: Record<string, { reserva: string; animal: string }> = {
  aguardando: { reserva: 'aguardando_presente', animal: 'aguardando_presente' },
  recebido: { reserva: 'presente_recebido', animal: 'presente_recebido' },
  concluir: { reserva: 'concluida', animal: 'concluida' },
  liberar: { reserva: 'cancelada', animal: 'disponivel' }, // desistência: libera a cartinha
};

// POST /api/admin/reserva  body: { codigo, acao }
export const POST: APIRoute = async ({ request, locals }) => {
  const db = (env as any).DB as D1Database | undefined;
  if (!db) return json({ erro: 'Banco indisponível' }, 503);
  const quem = locals.admin?.email || 'admin';

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return json({ erro: 'Requisição inválida' }, 400);
  }
  const codigo = String(b.codigo ?? '').trim();
  const acao = String(b.acao ?? '');
  const t = TRANSICOES[acao];
  if (!codigo || !t) return json({ erro: 'Ação inválida.' }, 400);

  const reserva = await db
    .prepare('SELECT id, animal_id FROM reservas WHERE codigo = ?')
    .bind(codigo)
    .first<{ id: number; animal_id: string }>();
  if (!reserva) return json({ erro: 'Reserva não encontrada.' }, 404);

  await db.batch([
    db
      .prepare("UPDATE reservas SET status = ?, atualizado_em = datetime('now') WHERE id = ?")
      .bind(t.reserva, reserva.id),
    db
      .prepare("UPDATE animais SET status = ?, atualizado_em = datetime('now') WHERE id = ?")
      .bind(t.animal, reserva.animal_id),
  ]);

  await registrarHistorico(db, 'reserva', codigo, acao, `${reserva.animal_id} -> ${t.reserva}`, quem);
  return json({ ok: true, status: t.reserva });
};
