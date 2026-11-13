import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../../lib/http';
import { COOKIE, destruirSessao } from '../../../lib/auth';

export const prerender = false;

// POST /api/admin/logout
export const POST: APIRoute = async ({ cookies }) => {
  const db = (env as any).DB as D1Database | undefined;
  const token = cookies.get(COOKIE)?.value;
  if (db && token) await destruirSessao(db, token).catch(() => {});
  cookies.delete(COOKIE, { path: '/' });
  return json({ ok: true });
};
