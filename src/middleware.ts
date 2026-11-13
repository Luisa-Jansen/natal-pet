import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { COOKIE, adminDoToken } from './lib/auth';

// Protege /admin/* e /api/admin/* (menos as rotas de login).
export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const ehPaginaAdmin = path.startsWith('/admin') && path !== '/admin/login';
  const ehApiAdmin = path.startsWith('/api/admin') && path !== '/api/admin/login';

  if (ehPaginaAdmin || ehApiAdmin) {
    const db = (env as any).DB as D1Database | undefined;
    const token = context.cookies.get(COOKIE)?.value;
    const admin = db ? await adminDoToken(db, token) : null;

    if (!admin) {
      if (ehApiAdmin) {
        return new Response(JSON.stringify({ erro: 'Não autorizado' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/admin/login');
    }
    context.locals.admin = admin;
  }

  return next();
});
