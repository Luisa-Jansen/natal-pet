import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json } from '../../lib/http';

export const prerender = false;

// POST /api/adotar  -> registra a adoção de uma cartinha
// body: { petId, petNome, pedido, nome, contato, cidade }
export const POST: APIRoute = async ({ request }) => {
  const db = (env as { DB?: D1Database }).DB;
  if (!db) return json({ erro: 'Banco de dados indisponível' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ erro: 'Requisição inválida' }, 400);
  }

  const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const petId = str(body.petId, 60);
  const petNome = str(body.petNome, 80);
  const pedido = str(body.pedido, 300);
  const nome = str(body.nome, 80);
  const contato = str(body.contato, 120);
  const cidade = str(body.cidade, 80);

  if (!petId || !petNome || nome.length < 2) {
    return json({ erro: 'Dados incompletos' }, 400);
  }

  try {
    await db
      .prepare(
        `INSERT INTO adocoes (pet_id, pet_nome, pedido, padrinho_nome, padrinho_contato, padrinho_cidade)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(petId, petNome, pedido, nome, contato, cidade)
      .run();
    return json({ ok: true });
  } catch (e) {
    const msg = String((e as Error).message || '');
    // pet_id é UNIQUE: se já existe, a cartinha já foi adotada
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return json({ erro: 'Esta cartinha já foi adotada' }, 409);
    }
    return json({ erro: 'Não foi possível registrar a adoção' }, 500);
  }
};
