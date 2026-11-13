import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json } from '../../lib/http';
import { contarPorStatus, idsIndisponiveis } from '../../lib/db';

export const prerender = false;

// GET /api/status
//   -> { adotadas: string[], total, disponivel, contagem: {...} }
//   "adotadas" = ids das cartinhas que NÃO estão disponíveis (reservada/concluída/etc.)
export const GET: APIRoute = async () => {
  const db = (env as { DB?: import('@cloudflare/workers-types').D1Database }).DB;
  if (!db) return json({ adotadas: [], total: 0, aviso: 'banco indisponivel' });

  try {
    const [contagem, adotadas] = await Promise.all([contarPorStatus(db), idsIndisponiveis(db)]);
    return json({
      adotadas,
      total: contagem.total,
      disponivel: contagem.disponivel,
      indisponivel: contagem.total - contagem.disponivel,
      contagem,
    });
  } catch (e) {
    // tabela ainda não criada ou outro erro: não quebra o site
    return json({ adotadas: [], total: 0, erro: (e as Error).message });
  }
};
