import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../lib/http';
import { obterAnimal, carregarConfig, codigoReserva, registrarHistorico } from '../../lib/db';

export const prerender = false;

const MODALIDADES = ['pix', 'compra_online', 'entrega_presencial'];

// POST /api/reservar
// body: { animalId, nome, whatsapp, email, modalidade }
// Cria padrinho + reserva de forma atômica. O índice único parcial em
// reservas(animal_id) WHERE status<>'cancelada' impede reserva dupla (-> 409).
export const POST: APIRoute = async ({ request }) => {
  const db = (env as any).DB as D1Database | undefined;
  if (!db) return json({ erro: 'Banco de dados indisponível' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ erro: 'Requisição inválida' }, 400);
  }

  const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const animalId = str(body.animalId, 60);
  const nome = str(body.nome, 80);
  const whatsapp = str(body.whatsapp, 40);
  const email = str(body.email, 120);
  const modalidade = str(body.modalidade, 30);

  if (!animalId || nome.length < 2) return json({ erro: 'Preencha seu nome completo.' }, 400);
  if (!whatsapp && !email) return json({ erro: 'Informe um WhatsApp ou e-mail para contato.' }, 400);
  if (!MODALIDADES.includes(modalidade)) return json({ erro: 'Escolha como deseja presentear.' }, 400);

  // cartinha precisa existir, estar ativa e disponível
  const animal = await obterAnimal(db, animalId);
  if (!animal || !animal.ativo) return json({ erro: 'Cartinha não encontrada.' }, 404);
  if (animal.status !== 'disponivel') {
    return json({ erro: 'Esta cartinha já foi reservada. Que tal escolher outra?' }, 409);
  }

  // código da campanha
  const cfg = await carregarConfig(db).catch(() => ({}) as Record<string, string>);
  const ano = cfg.campanha_ano || String(new Date().getFullYear());

  try {
    // 1) padrinho
    const padr = await db
      .prepare('INSERT INTO padrinhos (nome, whatsapp, email) VALUES (?, ?, ?)')
      .bind(nome, whatsapp || null, email || null)
      .run();
    const padrinhoId = padr.meta.last_row_id;

    // 2) reserva (código temporário único; vira o índice que bloqueia duplo)
    const tmp = 'TMP-' + crypto.randomUUID();
    const res = await db
      .prepare(
        `INSERT INTO reservas (codigo, animal_id, padrinho_id, modalidade, status)
         VALUES (?, ?, ?, ?, 'reservada')`
      )
      .bind(tmp, animalId, padrinhoId, modalidade)
      .run();
    const reservaId = res.meta.last_row_id as number;

    // 3) código definitivo + marca a cartinha como reservada
    const codigo = codigoReserva(ano, reservaId);
    await db.batch([
      db.prepare("UPDATE reservas SET codigo = ?, atualizado_em = datetime('now') WHERE id = ?").bind(codigo, reservaId),
      db.prepare("UPDATE animais SET status = 'reservada', atualizado_em = datetime('now') WHERE id = ?").bind(animalId),
    ]);

    await registrarHistorico(db, 'reserva', codigo, 'reserva_criada', `${animal.nome} · ${modalidade} · ${nome}`);

    return json({ ok: true, codigo, modalidade, animal: { id: animal.id, nome: animal.nome } }, 201);
  } catch (e) {
    const msg = String((e as Error).message || '');
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return json({ erro: 'Alguém reservou essa cartinha agora há pouco. Escolha outra.' }, 409);
    }
    return json({ erro: 'Não foi possível registrar a reserva. Tente novamente.' }, 500);
  }
};
