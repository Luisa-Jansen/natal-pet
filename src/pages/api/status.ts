import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json } from '../../lib/http';

export const prerender = false;

// GET /api/status  ->  { adotadas: string[], total: number }
export const GET: APIRoute = async () => {
  const db = (env as { DB?: D1Database }).DB;
  if (!db) return json({ adotadas: [], total: 0, aviso: 'banco indisponivel' });

  try {
    const { results } = await db.prepare('SELECT pet_id FROM adocoes').all<{ pet_id: string }>();
    const adotadas = (results ?? []).map((r) => r.pet_id);
    return json({ adotadas, total: adotadas.length });
  } catch (e) {
    // tabela ainda não criada ou outro erro: não quebra o site
    return json({ adotadas: [], total: 0, erro: (e as Error).message });
  }
};
