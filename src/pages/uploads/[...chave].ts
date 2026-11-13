import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { KVNamespace } from '@cloudflare/workers-types';

export const prerender = false;

// GET /uploads/<chave>  -> serve o arquivo guardado no KV (fotos, comprovantes)
export const GET: APIRoute = async ({ params }) => {
  const uploads = (env as any).UPLOADS as KVNamespace | undefined;
  const chave = String(params.chave || '');
  if (!uploads || !chave) return new Response('Não encontrado', { status: 404 });

  const { value, metadata } = await uploads.getWithMetadata<{ contentType?: string }>(chave, {
    type: 'arrayBuffer',
  });
  if (!value) return new Response('Não encontrado', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', metadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(value as ArrayBuffer, { headers });
};
