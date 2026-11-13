import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../../lib/http';
import { verificarSenha } from '../../../lib/db';
import { COOKIE, criarSessao, opcoesCookie } from '../../../lib/auth';

export const prerender = false;

// POST /api/admin/login  body: { email, senha }
export const POST: APIRoute = async ({ request, cookies, url }) => {
  const db = (env as any).DB as D1Database | undefined;
  if (!db) return json({ erro: 'Banco indisponível' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ erro: 'Requisição inválida' }, 400);
  }
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 120);
  const senha = String(body.senha ?? '');
  if (!email || !senha) return json({ erro: 'Informe e-mail e senha.' }, 400);

  const user = await db
    .prepare('SELECT id, senha_hash, senha_salt FROM usuarios_admin WHERE email = ?')
    .bind(email)
    .first<{ id: number; senha_hash: string; senha_salt: string }>();

  // mensagem genérica (não revela se o e-mail existe)
  const generico = () => json({ erro: 'E-mail ou senha incorretos.' }, 401);
  if (!user) {
    await verificarSenha(senha, '0'.repeat(64), '00'); // iguala o tempo de resposta
    return generico();
  }
  const ok = await verificarSenha(senha, user.senha_hash, user.senha_salt);
  if (!ok) return generico();

  const token = await criarSessao(db, user.id);
  cookies.set(COOKIE, token, opcoesCookie(url.protocol === 'https:'));
  return json({ ok: true });
};
