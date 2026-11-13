import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { R2Bucket } from '@cloudflare/workers-types';

export const prerender = false;

// GET /uploads/<chave>  -> serve o arquivo guardado no R2 (fotos, comprovantes)
export const GET: APIRoute = async ({ params }) => {
  const bucket = (env as any).UPLOADS as R2Bucket | undefined;
  const chave = String(params.chave || '');
  if (!bucket || !chave) return new Response('Não encontrado', { status: 404 });

  const obj = await bucket.get(chave);
  if (!obj) return new Response('Não encontrado', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers as unknown as Headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(obj.body as unknown as ReadableStream, { headers });
};
