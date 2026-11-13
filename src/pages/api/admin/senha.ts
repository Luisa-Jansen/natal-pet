import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../../lib/http';
import { verificarSenha, gerarHashSenha, registrarHistorico } from '../../../lib/db';

export const prerender = false;

// POST /api/admin/senha  body: { atual, nova }
export const POST: APIRoute = async ({ request, locals }) => {
  const db = (env as any).DB as D1Database | undefined;
  if (!db || !locals.admin) return json({ erro: 'Não autorizado' }, 401);

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return json({ erro: 'Requisição inválida' }, 400);
  }
  const atual = String(b.atual ?? '');
  const nova = String(b.nova ?? '');
  if (nova.length < 6) return json({ erro: 'A nova senha precisa de pelo menos 6 caracteres.' }, 400);

  const user = await db
    .prepare('SELECT senha_hash, senha_salt FROM usuarios_admin WHERE id = ?')
    .bind(locals.admin.id)
    .first<{ senha_hash: string; senha_salt: string }>();
  if (!user) return json({ erro: 'Usuário não encontrado.' }, 404);

  const ok = await verificarSenha(atual, user.senha_hash, user.senha_salt);
  if (!ok) return json({ erro: 'Senha atual incorreta.' }, 401);

  const { hash, salt } = await gerarHashSenha(nova);
  await db
    .prepare('UPDATE usuarios_admin SET senha_hash = ?, senha_salt = ? WHERE id = ?')
    .bind(hash, salt, locals.admin.id)
    .run();
  await registrarHistorico(db, 'config', 'usuario', 'senha_alterada', locals.admin.email, locals.admin.email);
  return json({ ok: true });
};
