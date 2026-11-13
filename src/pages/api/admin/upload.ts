import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { KVNamespace } from '@cloudflare/workers-types';
import { json } from '../../../lib/http';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

// POST /api/admin/upload  (multipart: arquivo, [pasta])  -> { url }
// Usado para fotos de animais e QR Code do PIX.
export const POST: APIRoute = async ({ request }) => {
  const uploads = (env as any).UPLOADS as KVNamespace | undefined;
  if (!uploads) return json({ erro: 'Armazenamento indisponível' }, 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ erro: 'Envio inválido' }, 400);
  }
  const arquivo = form.get('arquivo');
  const pasta = String(form.get('pasta') ?? 'fotos').replace(/[^a-z0-9_-]/gi, '') || 'fotos';
  if (!(arquivo instanceof File) || arquivo.size === 0) return json({ erro: 'Selecione um arquivo' }, 400);
  if (arquivo.size > MAX_BYTES) return json({ erro: 'Arquivo muito grande (máx. 8 MB)' }, 413);
  const tipo = arquivo.type || '';
  if (!EXT[tipo]) return json({ erro: 'Envie uma imagem PNG, JPG ou WEBP.' }, 415);

  const chave = `${pasta}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${EXT[tipo]}`;
  await uploads.put(chave, await arquivo.arrayBuffer(), { metadata: { contentType: tipo } });
  return json({ ok: true, url: `/uploads/${chave}` });
};
